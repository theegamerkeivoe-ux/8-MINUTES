import React, { useState, useEffect, useRef, useCallback } from 'react';
import { VideoClip, VideoProject, ViewMode } from './types';
import { extractVideoData } from './utils/videoExtractor';
import { Header } from './components/Header';
import { TopicBar } from './components/TopicBar';
import { ClipUploadZone } from './components/ClipUploadZone';
import { ClipList } from './components/ClipList';
import { FullScriptView } from './components/FullScriptView';
import { TeleprompterModal } from './components/TeleprompterModal';
import { ProjectsModal } from './components/ProjectsModal';
import { AlertCircle, CheckCircle2, Loader2, Sparkles, X } from 'lucide-react';
import { exportAsText } from './utils/exportHelpers';
import { safeFetchJson } from './utils/apiClient';

const STORAGE_KEY = 'cinevoice_current_project';

function createInitialProject(): VideoProject {
  const id = 'proj_' + Math.random().toString(36).substring(2, 9);
  return {
    id,
    title: '8 MINUTES — Episode 1',
    topic: '',
    tone: 'Conversational & Engaging (YouTube Creator)',
    targetAudience: 'General YouTube viewers',
    clips: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export default function App() {
  const [project, setProject] = useState<VideoProject>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.id) return parsed;
      }
    } catch (e) {
      console.warn('Could not parse saved project from localStorage:', e);
    }
    return createInitialProject();
  });

  const [viewMode, setViewMode] = useState<ViewMode>('clips');
  const [isProcessingUploads, setIsProcessingUploads] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState('');
  const [activeRegeneratingClipId, setActiveRegeneratingClipId] = useState<string | null>(null);
  const [activeRegeneratingTransitionClipId, setActiveRegeneratingTransitionClipId] = useState<string | null>(null);
  const [isResequencing, setIsResequencing] = useState(false);
  const [isPolishing, setIsPolishing] = useState(false);
  const [hasReorderedWithoutResync, setHasReorderedWithoutResync] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [isTeleprompterOpen, setIsTeleprompterOpen] = useState(false);
  const [isProjectsModalOpen, setIsProjectsModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Autosave to localStorage and server
  const persistProject = useCallback((projToSave: VideoProject) => {
    setSaveStatus('saving');
    try {
      // Prepare sanitized project for local storage (omit heavy blob references)
      const sanitized = {
        ...projToSave,
        updatedAt: new Date().toISOString(),
        clips: projToSave.clips.map((c) => ({
          ...c,
          file: undefined, // file instance cannot be JSON stringified
        })),
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));

      // Also persist to server in the background
      safeFetchJson('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: sanitized }),
      })
        .then(() => setSaveStatus('saved'))
        .catch(() => setSaveStatus('saved')); // local saved even if server offline
    } catch (err) {
      console.error('Failed to autosave project:', err);
      setSaveStatus('unsaved');
    }
  }, []);

  const triggerSave = useCallback(
    (updated: VideoProject) => {
      setProject(updated);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        persistProject(updated);
      }, 800);
    },
    [persistProject]
  );

  // File Upload and Frame Extraction Handler
  const handleFilesSelected = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((f) => f.type.startsWith('video/'));
    if (fileArray.length === 0) {
      setErrorMessage('Please select valid video files (MP4, WebM, MOV, etc.).');
      return;
    }

    setErrorMessage(null);
    setIsProcessingUploads(true);

    const initialClipsCount = project.clips.length;
    const newClips: VideoClip[] = [];

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      setUploadProgressText(`Analyzing clip ${i + 1} of ${fileArray.length} (${file.name})...`);

      const clipId = 'clip_' + Math.random().toString(36).substring(2, 10);
      const objectUrl = URL.createObjectURL(file);

      try {
        const extracted = await extractVideoData(file);

        newClips.push({
          id: clipId,
          file,
          filename: file.name,
          fileSize: file.size,
          duration: extracted.duration,
          objectUrl,
          thumbnailUrl: extracted.thumbnailUrl,
          frames: extracted.frames,
          order: initialClipsCount + i,
          status: 'ready',
        });
      } catch (err) {
        console.warn('Fallback for clip:', file.name, err);
        newClips.push({
          id: clipId,
          file,
          filename: file.name,
          fileSize: file.size,
          duration: 5,
          objectUrl,
          frames: [],
          order: initialClipsCount + i,
          status: 'ready',
        });
      }
    }

    setIsProcessingUploads(false);
    setUploadProgressText('');

    const updatedClips = [...project.clips, ...newClips];
    const updatedProject = {
      ...project,
      clips: updatedClips,
    };

    triggerSave(updatedProject);
    showToast(`Added ${newClips.length} ${newClips.length === 1 ? 'clip' : 'clips'}. Ready to generate.`);
  };

  // Reorder Clips
  const handleMoveClip = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= project.clips.length) return;

    const newClips = [...project.clips];
    const [moved] = newClips.splice(index, 1);
    newClips.splice(targetIndex, 0, moved);

    // Update order numbers
    newClips.forEach((c, idx) => {
      c.order = idx;
    });

    const updated = {
      ...project,
      clips: newClips,
    };

    setHasReorderedWithoutResync(true);
    triggerSave(updated);
  };

  // Delete Clip
  const handleDeleteClip = (clipId: string) => {
    const clipToDelete = project.clips.find((c) => c.id === clipId);
    if (clipToDelete?.objectUrl) {
      URL.revokeObjectURL(clipToDelete.objectUrl);
    }

    const filtered = project.clips
      .filter((c) => c.id !== clipId)
      .map((c, idx) => ({ ...c, order: idx }));

    const updated = {
      ...project,
      clips: filtered,
    };

    setHasReorderedWithoutResync(true);
    triggerSave(updated);
  };

  // Replace Video File for existing Clip
  const handleReplaceClipFile = async (clipId: string, newFile: File) => {
    setIsProcessingUploads(true);
    setUploadProgressText(`Replacing footage with ${newFile.name}...`);

    try {
      const extracted = await extractVideoData(newFile);
      const newObjectUrl = URL.createObjectURL(newFile);

      const updatedClips = project.clips.map((c) => {
        if (c.id === clipId) {
          if (c.objectUrl) URL.revokeObjectURL(c.objectUrl);
          return {
            ...c,
            file: newFile,
            filename: newFile.name,
            fileSize: newFile.size,
            duration: extracted.duration,
            objectUrl: newObjectUrl,
            thumbnailUrl: extracted.thumbnailUrl,
            frames: extracted.frames,
            // Keep existing commentary or reset based on user needs
            status: 'ready' as const,
          };
        }
        return c;
      });

      const updated = {
        ...project,
        clips: updatedClips,
      };

      triggerSave(updated);
      showToast(`Replaced footage for ${newFile.name}`);
    } catch (err) {
      console.error('Error replacing clip:', err);
    } finally {
      setIsProcessingUploads(false);
      setUploadProgressText('');
    }
  };

  // Update Individual Fields
  const handleUpdateCommentary = (clipId: string, commentary: string) => {
    const updatedClips = project.clips.map((c) => (c.id === clipId ? { ...c, commentary, isCustomEdited: true } : c));
    triggerSave({ ...project, clips: updatedClips });
  };

  const handleUpdateTransition = (clipId: string, transition: string) => {
    const updatedClips = project.clips.map((c) => (c.id === clipId ? { ...c, transition, isCustomEdited: true } : c));
    triggerSave({ ...project, clips: updatedClips });
  };

  const handleUpdateNotes = (clipId: string, notes: string) => {
    const updatedClips = project.clips.map((c) => (c.id === clipId ? { ...c, notes } : c));
    triggerSave({ ...project, clips: updatedClips });
  };

  const handleUpdateHook = (hookIntro: string) => {
    triggerSave({ ...project, hookIntro });
  };

  const handleUpdateOutro = (outro: string) => {
    triggerSave({ ...project, outro });
  };

  const handleUpdateFullScript = (fullScript: string) => {
    triggerSave({ ...project, fullScript });
  };

  // Generate Commentary for All Clips
  const handleGenerateCommentary = async () => {
    if (!project.topic.trim()) {
      setErrorMessage('Please enter the overall video topic or title before generating commentary.');
      return;
    }

    if (project.clips.length === 0) {
      setErrorMessage('Please upload at least one video clip.');
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);
    setGenerationStep('Analyzing visual keyframes and narrative continuity...');

    try {
      const payload = {
        topic: project.topic,
        tone: project.tone,
        targetAudience: project.targetAudience,
        clips: project.clips.map((c) => ({
          id: c.id,
          filename: c.filename,
          order: c.order,
          duration: c.duration,
          notes: c.notes,
          frames: c.frames,
        })),
      };

      const data = await safeFetchJson('/api/generate-commentary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      // Merge results into clips
      const commentaryMap = new Map<string, any>();
      (data.clipCommentaries || []).forEach((item: any) => {
        commentaryMap.set(item.clipId, item);
      });

      const updatedClips = project.clips.map((c, index) => {
        const gen = commentaryMap.get(c.id) || data.clipCommentaries?.[index];
        if (gen) {
          return {
            ...c,
            commentary: gen.commentary || '',
            transition: gen.transition || '',
            visualObservation: gen.visualObservation || '',
            status: 'completed' as const,
          };
        }
        return c;
      });

      const updatedProject: VideoProject = {
        ...project,
        hookIntro: data.hookIntro || project.hookIntro,
        outro: data.outro || project.outro,
        fullScript: data.fullScript || '',
        clips: updatedClips,
      };

      setHasReorderedWithoutResync(false);
      triggerSave(updatedProject);
      showToast('Commentary generated successfully!');
    } catch (err: any) {
      console.error('Generation error:', err);
      setErrorMessage(err.message || 'An error occurred while generating commentary. Please try again.');
    } finally {
      setIsGenerating(false);
      setGenerationStep('');
    }
  };

  // Regenerate Single Clip
  const handleRegenerateClip = async (clipId: string, customInstruction?: string) => {
    const clipIndex = project.clips.findIndex((c) => c.id === clipId);
    if (clipIndex === -1) return;

    const clip = project.clips[clipIndex];
    const prevClip = project.clips[clipIndex - 1];
    const nextClip = project.clips[clipIndex + 1];

    setActiveRegeneratingClipId(clipId);
    setErrorMessage(null);

    try {
      const data = await safeFetchJson('/api/regenerate-clip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: project.topic,
          clip: {
            id: clip.id,
            filename: clip.filename,
            order: clip.order,
            duration: clip.duration,
            notes: clip.notes,
            frames: clip.frames,
          },
          previousClipCommentary: prevClip?.commentary,
          nextClipInfo: nextClip ? { filename: nextClip.filename, notes: nextClip.notes } : null,
          customInstruction,
        }),
      });

      const updatedClips = project.clips.map((c) => {
        if (c.id === clipId) {
          return {
            ...c,
            commentary: data.commentary,
            transition: data.transition,
            visualObservation: data.visualObservation || c.visualObservation,
          };
        }
        return c;
      });

      const updated = { ...project, clips: updatedClips };
      triggerSave(updated);
      showToast(`Regenerated Clip #${clipIndex + 1}`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to regenerate clip commentary.');
    } finally {
      setActiveRegeneratingClipId(null);
    }
  };

  // Regenerate Single Transition
  const handleRegenerateTransition = async (clipId: string) => {
    const clipIndex = project.clips.findIndex((c) => c.id === clipId);
    if (clipIndex === -1) return;

    const clip = project.clips[clipIndex];
    const nextClip = project.clips[clipIndex + 1];

    setActiveRegeneratingTransitionClipId(clipId);
    setErrorMessage(null);

    try {
      const data = await safeFetchJson('/api/regenerate-transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: project.topic,
          currentClip: {
            id: clip.id,
            filename: clip.filename,
            commentary: clip.commentary,
          },
          nextClip: nextClip
            ? {
                filename: nextClip.filename,
                commentary: nextClip.commentary,
                notes: nextClip.notes,
              }
            : null,
        }),
      });

      const updatedClips = project.clips.map((c) => {
        if (c.id === clipId) {
          return {
            ...c,
            transition: data.transition,
          };
        }
        return c;
      });

      const updated = { ...project, clips: updatedClips };
      triggerSave(updated);
      showToast(`Updated transition for Clip #${clipIndex + 1}`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to regenerate transition.');
    } finally {
      setActiveRegeneratingTransitionClipId(null);
    }
  };

  // Re-sequence all transitions when clips are reordered
  const handleResequenceTransitions = async () => {
    if (project.clips.length < 2) return;

    setIsResequencing(true);
    setErrorMessage(null);

    try {
      const data = await safeFetchJson('/api/resequence-transitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: project.topic,
          clips: project.clips,
        }),
      });

      const transitionMap = new Map<string, string>();
      (data.transitions || []).forEach((t: any) => {
        transitionMap.set(t.clipId, t.transition);
      });

      const updatedClips = project.clips.map((c) => {
        if (transitionMap.has(c.id)) {
          return {
            ...c,
            transition: transitionMap.get(c.id),
          };
        }
        return c;
      });

      const updated = { ...project, clips: updatedClips };
      setHasReorderedWithoutResync(false);
      triggerSave(updated);
      showToast('All transitions updated to match the new clip sequence!');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to resequence transitions.');
    } finally {
      setIsResequencing(false);
    }
  };

  // Polish full continuous master script
  const handlePolishScript = async () => {
    setIsPolishing(true);
    setErrorMessage(null);

    try {
      const data = await safeFetchJson('/api/synthesize-full-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: project.topic,
          hookIntro: project.hookIntro,
          outro: project.outro,
          clips: project.clips,
        }),
      });

      const updated = {
        ...project,
        fullScript: data.polishedScript,
      };

      triggerSave(updated);
      showToast('Master script polished and synchronized!');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to polish script.');
    } finally {
      setIsPolishing(false);
    }
  };

  // Project Management
  const handleNewProject = () => {
    if (project.clips.length > 0 && !confirm('Create a new project? Your current work is already saved.')) {
      return;
    }
    const newProj = createInitialProject();
    setProject(newProj);
    persistProject(newProj);
    setViewMode('clips');
    setHasReorderedWithoutResync(false);
    showToast('New project created. Start by adding your video topic and clips.');
  };

  const handleSelectProject = async (projectId: string) => {
    try {
      const data = await safeFetchJson(`/api/projects/${projectId}`);
      if (data.project) {
        setProject(data.project);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data.project));
        showToast(`Loaded: ${data.project.title || data.project.topic || 'Project'}`);
      }
    } catch (err) {
      console.error('Failed to load project:', err);
    }
  };

  const handleRenameProject = (newTitle: string) => {
    triggerSave({ ...project, title: newTitle });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <Header
        project={project}
        viewMode={viewMode}
        setViewMode={setViewMode}
        onNewProject={handleNewProject}
        onOpenProjects={() => setIsProjectsModalOpen(true)}
        onOpenTeleprompter={() => setIsTeleprompterOpen(true)}
        onRenameProject={handleRenameProject}
        saveStatus={saveStatus}
      />

      {/* Main Workspace Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
        {/* Error Notification Banner */}
        {errorMessage && (
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-red-950/40 border border-red-900/60 text-red-300 text-xs shadow-lg animate-in fade-in duration-200">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="p-1 rounded text-red-400 hover:text-white hover:bg-red-900/40 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Success Toast */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-2 duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Global Loading / Generating Overlay */}
        {isGenerating && (
          <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-950/30 via-slate-900/60 to-amber-950/30 p-5 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4 mb-3">
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-md shadow-amber-500/10">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
                <div>
                  <p className="font-display text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2">
                    <span>8 MINUTES Commentary Engine</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                  </p>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {generationStep || 'Analyzing visual video keyframes, narrative pacing, and transitions...'}
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-semibold text-amber-400/90 hidden sm:inline">
                Live Processing
              </span>
            </div>
            {/* Shimmer line */}
            <div className="h-1.5 w-full rounded-full bg-slate-950 overflow-hidden border border-slate-800/80">
              <div className="h-full w-full animate-shimmer" />
            </div>
          </div>
        )}

        {/* Video Topic & Style Bar */}
        <TopicBar
          topic={project.topic}
          setTopic={(t) => triggerSave({ ...project, topic: t })}
          tone={project.tone}
          setTone={(t) => triggerSave({ ...project, tone: t })}
          targetAudience={project.targetAudience}
          setTargetAudience={(a) => triggerSave({ ...project, targetAudience: a })}
          onGenerate={handleGenerateCommentary}
          isGenerating={isGenerating}
          clipCount={project.clips.length}
        />

        {/* View Mode Switching: Clip-by-Clip Editor vs Full Continuous Script */}
        {viewMode === 'clips' ? (
          <div className="flex flex-col gap-6">
            {/* Upload Zone (Adapts automatically if workspace has clips or is empty) */}
            <ClipUploadZone
              onFilesSelected={handleFilesSelected}
              isProcessingUploads={isProcessingUploads}
              uploadProgressText={uploadProgressText}
              hasClips={project.clips.length > 0}
            />

            {/* Clips List & Editor */}
            {project.clips.length > 0 && (
              <ClipList
                clips={project.clips}
                hookIntro={project.hookIntro}
                outro={project.outro}
                onUpdateHook={handleUpdateHook}
                onUpdateOutro={handleUpdateOutro}
                onUpdateCommentary={handleUpdateCommentary}
                onUpdateTransition={handleUpdateTransition}
                onUpdateNotes={handleUpdateNotes}
                onMoveUp={(idx) => handleMoveClip(idx, 'up')}
                onMoveDown={(idx) => handleMoveClip(idx, 'down')}
                onDelete={handleDeleteClip}
                onReplaceFile={handleReplaceClipFile}
                onRegenerateCommentary={handleRegenerateClip}
                onRegenerateTransition={handleRegenerateTransition}
                onResequenceTransitions={handleResequenceTransitions}
                isResequencing={isResequencing}
                activeRegeneratingClipId={activeRegeneratingClipId}
                activeRegeneratingTransitionClipId={activeRegeneratingTransitionClipId}
                hasReorderedWithoutResync={hasReorderedWithoutResync}
                onNotify={showToast}
              />
            )}
          </div>
        ) : (
          /* Full Continuous Script Mode */
          <FullScriptView
            project={project}
            onUpdateFullScript={handleUpdateFullScript}
            onPolishScript={handlePolishScript}
            isPolishing={isPolishing}
            onOpenTeleprompter={() => setIsTeleprompterOpen(true)}
            onNotify={showToast}
          />
        )}
      </main>

      {/* Teleprompter Modal */}
      <TeleprompterModal
        isOpen={isTeleprompterOpen}
        onClose={() => setIsTeleprompterOpen(false)}
        scriptText={project.fullScript || exportAsText(project)}
        topicTitle={project.title || project.topic}
      />

      {/* Saved Projects Modal */}
      <ProjectsModal
        isOpen={isProjectsModalOpen}
        onClose={() => setIsProjectsModalOpen(false)}
        onSelectProject={handleSelectProject}
        onNewProject={handleNewProject}
        currentProjectId={project.id}
      />
    </div>
  );
}
