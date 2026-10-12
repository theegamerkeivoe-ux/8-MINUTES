import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Support high payload limit for base64 keyframes from clips
app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ extended: true, limit: '60mb' }));

// Initialize GenAI SDK with required aistudio-build User-Agent
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Ensure data persistence directory exists
const DATA_DIR = process.env.VERCEL ? path.join('/tmp', 'data') : path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');

function readProjects(): any[] {
  try {
    if (fs.existsSync(PROJECTS_FILE)) {
      const data = fs.readFileSync(PROJECTS_FILE, 'utf-8');
      return JSON.parse(data) || [];
    }
  } catch (err) {
    console.error('Error reading projects:', err);
  }
  return [];
}

function writeProjects(projects: any[]) {
  try {
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing projects:', err);
  }
}

const apiRouter = express.Router();

// Health check
apiRouter.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Project persistence endpoints
apiRouter.get('/projects', (req, res) => {
  const projects = readProjects();
  // Strip huge frame arrays from summary list for fast response
  const summaries = projects.map(p => ({
    id: p.id,
    title: p.title || p.topic || 'Untitled Project',
    topic: p.topic,
    style: p.style,
    clipCount: p.clips ? p.clips.length : 0,
    updatedAt: p.updatedAt,
    createdAt: p.createdAt,
    hasGeneratedScript: Boolean(p.fullScript || (p.clips && p.clips.some((c: any) => c.commentary)))
  }));
  res.json({ projects: summaries });
});

apiRouter.get('/projects/:id', (req, res) => {
  const projects = readProjects();
  const project = projects.find(p => p.id === req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  res.json({ project });
});

apiRouter.post('/projects', (req, res) => {
  try {
    const { project } = req.body;
    if (!project || !project.id) {
      return res.status(400).json({ error: 'Project data with ID required' });
    }

    const projects = readProjects();
    const existingIndex = projects.findIndex(p => p.id === project.id);
    const updatedProject = {
      ...project,
      updatedAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      projects[existingIndex] = updatedProject;
    } else {
      projects.unshift(updatedProject);
    }

    writeProjects(projects);
    res.json({ success: true, project: updatedProject });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to save project' });
  }
});

apiRouter.delete('/projects/:id', (req, res) => {
  const projects = readProjects();
  const filtered = projects.filter(p => p.id !== req.params.id);
  writeProjects(filtered);
  res.json({ success: true });
});

interface ClipPayload {
  id: string;
  filename: string;
  order: number;
  duration?: number;
  notes?: string;
  frames?: string[]; // base64 images (data:image/jpeg;base64,... or pure base64)
}

function cleanBase64(dataUrl: string): { data: string; mimeType: string } {
  if (dataUrl.startsWith('data:')) {
    const matches = dataUrl.match(/^data:([a-zA-Z0-9/+.-]+);base64,(.+)$/);
    if (matches) {
      return { mimeType: matches[1], data: matches[2] };
    }
  }
  return { mimeType: 'image/jpeg', data: dataUrl };
}

/**
 * AI-powered commentary generation for uploaded clips.
 * Handles single or multiple clips in smart sequential batches to preserve narrative arc and transitions.
 */
apiRouter.post('/generate-commentary', async (req, res) => {
  try {
    const { topic, tone = 'engaging & natural', targetAudience = 'YouTube viewers', clips = [] } = req.body as {
      topic: string;
      tone?: string;
      targetAudience?: string;
      clips: ClipPayload[];
    };

    if (!topic || typeof topic !== 'string' || !topic.trim()) {
      return res.status(400).json({ error: 'A video topic or title is required.' });
    }

    if (!Array.isArray(clips) || clips.length === 0) {
      return res.status(400).json({ error: 'At least one uploaded clip is required.' });
    }

    // Sort clips strictly by intended sequence order
    const sortedClips = [...clips].sort((a, b) => a.order - b.order);

    // Prompt Gemini with strict creator-focused guidelines
    const systemPrompt = `You are an elite, natural human video creator and commentary writer (in the style of top engaging YouTube creators like Johnny Harris, Mark Rober, Lemmino, or Ryan Trahan).
You are writing a cohesive, continuous commentary script for a video about: "${topic}".
Tone and style: "${tone}".
Target audience: "${targetAudience}".

CRITICAL CREATOR STANDARDS:
1. Speak like a real human creator speaking naturally to an audience, never like an AI reading a bulleted report or an encyclopedia.
2. Ground your commentary strictly in the visual evidence provided in each clip. Do NOT hallucinate names, fake dialogue, or facts that cannot be seen. If something is ambiguous, frame it candidly with real human curiosity (e.g. "Notice right here...", "Look closely at...", "What caught my eye immediately...").
3. CONNECT EVERY CLIP TO THE NEXT SEAMLESSLY. The script must feel like ONE continuous narrative journey, not disconnected clip reactions. Each clip's commentary must culminate in or set up a natural transition that hooks into the next moment.
4. Vary sentence structure, rhythm, and transitions. Avoid repetitive clichés like "In this clip", "Next up", or "Moving on". Use authentic creator transitions (e.g., contrasting, escalating stakes, building mystery, pointing out an unexpected shift, or continuing the momentum).
5. The very first clip or introduction must immediately grab attention with a killer opening hook.
6. The final clip must wrap up the story with a satisfying, memorable concluding thought, NOT a transition to another clip.`;

    // Process clips in batches of up to 4 clips at a time if there are many, to ensure high visual fidelity and avoid token truncation
    const BATCH_SIZE = 4;
    const allClipResults: any[] = [];
    let accumulatedNarrativeContext = '';
    let hookIntro = '';
    let finalOutro = '';

    for (let batchIdx = 0; batchIdx < sortedClips.length; batchIdx += BATCH_SIZE) {
      const batch = sortedClips.slice(batchIdx, batchIdx + BATCH_SIZE);
      const isFirstBatch = batchIdx === 0;
      const isLastBatch = batchIdx + BATCH_SIZE >= sortedClips.length;

      const contentsParts: any[] = [];

      let batchInstruction = `Generate script sections for Clips ${batchIdx + 1} through ${batchIdx + batch.length} of ${sortedClips.length}.\n`;
      if (isFirstBatch) {
        batchInstruction += `Also write a punchy 1-2 sentence Hook Intro to kick off the video before clip 1.\n`;
      }
      if (isLastBatch) {
        batchInstruction += `Also write a closing 1-2 sentence Outro wrap-up for the conclusion of the video.\n`;
      }
      if (accumulatedNarrativeContext) {
        batchInstruction += `Prior narrative context leading up to this batch:\n"${accumulatedNarrativeContext}"\n`;
      }

      batchInstruction += `For each clip below, inspect the provided keyframe images, summarize what is actually visible, and produce the creator commentary and next-clip transition.\n\n`;

      contentsParts.push({ text: batchInstruction });

      // Add each clip's images and metadata
      batch.forEach((clip, index) => {
        const globalIndex = batchIdx + index + 1;
        const isFinalClipInVideo = globalIndex === sortedClips.length;
        const nextClip = sortedClips[batchIdx + index + 1];

        let clipLabel = `\n--- CLIP #${globalIndex} (ID: "${clip.id}", Filename: "${clip.filename}", Duration: ${clip.duration || 0}s) ---\n`;
        if (clip.notes) {
          clipLabel += `User-provided context/notes: "${clip.notes}"\n`;
        }
        if (isFinalClipInVideo) {
          clipLabel += `[NOTE: This is the FINAL clip of the entire video. The transition must be a natural conclusion wrap-up rather than a handoff to another clip.]\n`;
        } else if (nextClip) {
          clipLabel += `[NOTE: Followed by Clip #${globalIndex + 1} ("${nextClip.filename}"). Transition must bridge naturally from this clip into the next one.]\n`;
        }
        contentsParts.push({ text: clipLabel });

        if (clip.frames && clip.frames.length > 0) {
          // Add up to 3 frames per clip to stay well within payload constraints
          clip.frames.slice(0, 3).forEach((frameStr, fIdx) => {
            const cleaned = cleanBase64(frameStr);
            contentsParts.push({
              inlineData: {
                mimeType: cleaned.mimeType,
                data: cleaned.data,
              },
            });
            contentsParts.push({ text: `[Clip #${globalIndex} - Frame ${fIdx + 1}]` });
          });
        } else {
          contentsParts.push({ text: `[No visual frames uploaded for this clip; rely strictly on filename "${clip.filename}" and context.]` });
        }
      });

      // Request structured JSON matching schema
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: { parts: contentsParts },
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              ...(isFirstBatch ? { hookIntro: { type: Type.STRING, description: 'Engaging opening creator hook for the overall video' } } : {}),
              ...(isLastBatch ? { outro: { type: Type.STRING, description: 'Closing takeaway and natural sign-off' } } : {}),
              clips: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    clipId: { type: Type.STRING },
                    clipNumber: { type: Type.INTEGER },
                    visualObservation: { type: Type.STRING, description: 'Factual summary of visible actions, people, pacing, or scene details' },
                    commentary: { type: Type.STRING, description: 'Engaging narration for this specific clip' },
                    transition: { type: Type.STRING, description: 'Natural transition bridging directly to next clip or final outro' },
                  },
                  required: ['clipId', 'commentary', 'transition', 'visualObservation'],
                },
              },
            },
            required: ['clips'],
          },
        },
      });

      const rawJson = response.text || '{}';
      const parsed = JSON.parse(rawJson);

      if (isFirstBatch && parsed.hookIntro) {
        hookIntro = parsed.hookIntro;
      }
      if (isLastBatch && parsed.outro) {
        finalOutro = parsed.outro;
      }

      if (Array.isArray(parsed.clips)) {
        parsed.clips.forEach((c: any) => {
          allClipResults.push(c);
          accumulatedNarrativeContext += ` [Clip ${c.clipNumber}: ${c.commentary} -> ${c.transition}]`;
        });
      }
    }

    // Build the consolidated full continuous script
    let fullScriptParts: string[] = [];
    if (hookIntro) {
      fullScriptParts.push(`[INTRO HOOK]\n${hookIntro}\n`);
    }

    allClipResults.forEach((cr, idx) => {
      const clipMeta = sortedClips.find(c => c.id === cr.clipId) || sortedClips[idx];
      fullScriptParts.push(`[CLIP ${idx + 1}: ${clipMeta?.filename || 'Clip'}]\n${cr.commentary}\n\n${cr.transition}\n`);
    });

    if (finalOutro) {
      fullScriptParts.push(`[OUTRO]\n${finalOutro}`);
    }

    const fullScript = fullScriptParts.join('\n').trim();

    res.json({
      success: true,
      hookIntro,
      outro: finalOutro,
      clipCommentaries: allClipResults,
      fullScript,
    });
  } catch (error: any) {
    console.error('Error generating commentary:', error);
    res.status(500).json({
      error: error.message || 'Failed to generate commentary. Please verify your clips and topic.',
    });
  }
});

/**
 * Regenerate commentary for an individual clip while preserving overall video context.
 */
apiRouter.post('/regenerate-clip', async (req, res) => {
  try {
    const { topic, clip, previousClipCommentary, nextClipInfo, customInstruction } = req.body;

    if (!topic || !clip) {
      return res.status(400).json({ error: 'Topic and clip data required.' });
    }

    const systemPrompt = `You are an elite video creator regenerating the commentary for one specific clip in a video about "${topic}".
Keep the voice conversational, insightful, and natural.
Ground your commentary strictly in the visual evidence.
Create a seamless transition connecting this clip to the next clip.`;

    const parts: any[] = [];
    let promptText = `Regenerate commentary for Clip #${clip.order || 1} ("${clip.filename}").\n`;
    if (previousClipCommentary) {
      promptText += `Previous clip commentary ended with: "${previousClipCommentary}"\n`;
    }
    if (nextClipInfo) {
      promptText += `Next clip is: "${nextClipInfo.filename}" (Notes: "${nextClipInfo.notes || 'None'}"). The transition must lead naturally into it.\n`;
    } else {
      promptText += `This is the final clip of the video. The transition should provide a natural conclusion.\n`;
    }
    if (customInstruction) {
      promptText += `Creator specific request: "${customInstruction}"\n`;
    }
    if (clip.notes) {
      promptText += `Clip context notes: "${clip.notes}"\n`;
    }

    parts.push({ text: promptText });

    if (clip.frames && clip.frames.length > 0) {
      clip.frames.slice(0, 3).forEach((frameStr: string, idx: number) => {
        const cleaned = cleanBase64(frameStr);
        parts.push({
          inlineData: { mimeType: cleaned.mimeType, data: cleaned.data },
        });
        parts.push({ text: `[Clip Frame ${idx + 1}]` });
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: { parts },
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            visualObservation: { type: Type.STRING, description: 'What is actually happening in the clip' },
            commentary: { type: Type.STRING, description: 'The new natural commentary for this clip' },
            transition: { type: Type.STRING, description: 'Seamless transition leading to the next clip or ending' },
          },
          required: ['visualObservation', 'commentary', 'transition'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json({
      success: true,
      clipId: clip.id,
      ...parsed,
    });
  } catch (error: any) {
    console.error('Error regenerating clip:', error);
    res.status(500).json({ error: error.message || 'Failed to regenerate clip commentary.' });
  }
});

/**
 * Regenerate ONLY the transition between two clips without changing the commentary.
 */
apiRouter.post('/regenerate-transition', async (req, res) => {
  try {
    const { topic, currentClip, nextClip } = req.body;

    if (!topic || !currentClip) {
      return res.status(400).json({ error: 'Topic and current clip are required.' });
    }

    const systemPrompt = `You are a video scriptwriter perfecting transitions between clips for a video about "${topic}".
Write a fresh, authentic, natural transition line that bridges Clip A to Clip B.
Avoid clichés like "In the next clip" or "Moving on". Use natural connective reasoning based on their content.`;

    let instruction = `Current Clip commentary: "${currentClip.commentary || currentClip.filename}"\n`;
    if (nextClip) {
      instruction += `Next Clip info: "${nextClip.filename}" (${nextClip.commentary ? 'Commentary: ' + nextClip.commentary : 'Notes: ' + (nextClip.notes || 'None')})\n`;
      instruction += `Write an engaging transition line to bridge from Current Clip to Next Clip.`;
    } else {
      instruction += `This is the last clip in the video. Write a concluding closing transition/wrap-up sentence.`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: instruction,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transition: { type: Type.STRING, description: 'The refreshed transition line' },
            explanation: { type: Type.STRING, description: 'Why this transition fits the narrative arc' },
          },
          required: ['transition'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json({ success: true, ...parsed });
  } catch (error: any) {
    console.error('Error regenerating transition:', error);
    res.status(500).json({ error: error.message || 'Failed to regenerate transition.' });
  }
});

/**
 * Re-sequence transitions when clips are reordered or removed.
 */
apiRouter.post('/resequence-transitions', async (req, res) => {
  try {
    const { topic, clips } = req.body;

    if (!topic || !Array.isArray(clips) || clips.length === 0) {
      return res.status(400).json({ error: 'Topic and clips array required.' });
    }

    const systemPrompt = `You are a script supervisor rewriting the transitional connective tissue for a video sequence about "${topic}".
The clips have been reordered. Keep each clip's main commentary intact, but craft a brand new, natural transition for each clip to smoothly introduce the newly adjacent clip.
Ensure the final clip concludes gracefully without leading into another clip.`;

    const clipsSummary = clips.map((c, i) => ({
      clipId: c.id,
      clipNumber: i + 1,
      filename: c.filename,
      commentary: c.commentary || 'Visual footage',
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Here is the newly ordered clip sequence:\n${JSON.stringify(clipsSummary, null, 2)}\nRewrite the transition for each clip in the new order.`,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transitions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  clipId: { type: Type.STRING },
                  transition: { type: Type.STRING },
                },
                required: ['clipId', 'transition'],
              },
            },
          },
          required: ['transitions'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json({ success: true, transitions: parsed.transitions || [] });
  } catch (error: any) {
    console.error('Error resequencing transitions:', error);
    res.status(500).json({ error: error.message || 'Failed to resequence transitions.' });
  }
});

/**
 * Synthesize polished continuous script for teleprompter and export
 */
apiRouter.post('/synthesize-full-script', async (req, res) => {
  try {
    const { topic, hookIntro, outro, clips } = req.body;

    const systemPrompt = `You are a master script editor polishing a continuous video commentary script for "${topic}".
Combine the hook, clip narrations, transitions, and outro into one masterfully flowing, spoken-word script.
Eliminate any awkward accidental repetitions between sections, smooth out pacing, and add optional unobtrusive cue markers (e.g. [CLIP 1: filename]) so a creator reading off a teleprompter knows exactly when each clip is displayed.`;

    const payload = {
      topic,
      hookIntro,
      outro,
      clips: (clips || []).map((c: any, i: number) => ({
        index: i + 1,
        filename: c.filename,
        commentary: c.commentary,
        transition: c.transition,
      })),
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: JSON.stringify(payload),
      config: {
        systemInstruction: systemPrompt,
      },
    });

    const polishedScript = response.text || '';
    res.json({ success: true, polishedScript });
  } catch (error: any) {
    console.error('Error synthesizing full script:', error);
    res.status(500).json({ error: error.message || 'Failed to synthesize script.' });
  }
});

/**
 * Generate speech read-through using Gemini TTS (gemini-3.8-flash-lite-tts)
 */
apiRouter.post('/generate-tts', async (req, res) => {
  try {
    const { text, voice = 'Zephyr' } = req.body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Text is required for TTS generation.' });
    }

    // Limit text length per TTS preview call to keep response fast (first ~1000 characters or section)
    const previewText = text.slice(0, 1200);

    const validVoices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
    const chosenVoice = validVoices.includes(voice) ? voice : 'Zephyr';

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: previewText,
              speechMetadata: {
                style: 'Natural, engaging video commentary narration',
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: chosenVoice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      return res.status(500).json({ error: 'No audio returned from speech model' });
    }

    res.json({
      success: true,
      audioData: `data:audio/wav;base64,${base64Audio}`,
      voice: chosenVoice,
    });
  } catch (error: any) {
    console.error('Error generating TTS:', error);
    res.status(500).json({ error: error.message || 'Failed to generate voice preview.' });
  }
});

// Mount API router under both /api and root to support Vercel serverless rewrites seamlessly
app.use('/api', apiRouter);
app.use(apiRouter);

// Setup Vite dev server or static file serving
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: PORT,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`8 MINUTES server running on http://0.0.0.0:${PORT}`);
  });
}

const isDirectExecution = process.argv[1] && (
  process.argv[1].endsWith('server.ts') ||
  process.argv[1].endsWith('server.js')
);

if (isDirectExecution && !process.env.VERCEL) {
  startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

export default app;
