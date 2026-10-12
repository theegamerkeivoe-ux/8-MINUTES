import { VideoProject } from '../types';

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function formatSrtTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const ms = Math.floor((totalSeconds % 1) * 1000);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

export function downloadFile(content: string, filename: string, mimeType: string = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Clean plain text narration for teleprompter or voiceover
 */
export function exportAsText(project: VideoProject): string {
  const lines: string[] = [];

  lines.push(`VIDEO TOPIC: ${project.topic}`);
  lines.push(`TONE: ${project.tone}`);
  lines.push('----------------------------------------\n');

  if (project.hookIntro) {
    lines.push(`[INTRO]`);
    lines.push(project.hookIntro);
    lines.push('\n');
  }

  let cumulativeTime = 0;
  project.clips.forEach((clip, idx) => {
    const timeStr = formatTime(cumulativeTime);
    lines.push(`[CLIP ${idx + 1} (${timeStr}): ${clip.filename}]`);
    if (clip.commentary) {
      lines.push(clip.commentary);
    }
    if (clip.transition) {
      lines.push(`-> ${clip.transition}`);
    }
    lines.push('\n');
    cumulativeTime += clip.duration || 5;
  });

  if (project.outro) {
    lines.push(`[OUTRO]`);
    lines.push(project.outro);
    lines.push('\n');
  }

  return lines.join('\n');
}

/**
 * Structured Markdown document for video editing suites & documentation
 */
export function exportAsMarkdown(project: VideoProject): string {
  const lines: string[] = [];

  lines.push(`# ${project.title || project.topic}`);
  lines.push(`**Topic:** ${project.topic}  `);
  lines.push(`**Style & Tone:** ${project.tone}  `);
  lines.push(`**Target Audience:** ${project.targetAudience}  `);
  lines.push(`**Total Clips:** ${project.clips.length}  `);
  lines.push(`\n---\n`);

  if (project.hookIntro) {
    lines.push(`## 00. Opening Hook`);
    lines.push(`> ${project.hookIntro}\n`);
  }

  let cumulativeTime = 0;
  project.clips.forEach((clip, idx) => {
    const timeStart = formatTime(cumulativeTime);
    const durationSec = clip.duration || 5;
    cumulativeTime += durationSec;
    const timeEnd = formatTime(cumulativeTime);

    lines.push(`### Clip ${idx + 1}: ${clip.filename}`);
    lines.push(`- **Timeline:** ${timeStart} – ${timeEnd} (${durationSec}s)`);
    if (clip.visualObservation) {
      lines.push(`- **Visual Context:** ${clip.visualObservation}`);
    }
    if (clip.notes) {
      lines.push(`- **Creator Notes:** ${clip.notes}`);
    }
    lines.push(`\n**Narration:**\n${clip.commentary || '*(No commentary generated)*'}\n`);
    if (clip.transition) {
      lines.push(`**Transition to Next:**\n*${clip.transition}*\n`);
    }
    lines.push(`---\n`);
  });

  if (project.outro) {
    lines.push(`## Conclusion & Outro`);
    lines.push(`> ${project.outro}\n`);
  }

  return lines.join('\n');
}

/**
 * Structured JSON export for developer/automation pipelines
 */
export function exportAsJSON(project: VideoProject): string {
  const cleanProject = {
    ...project,
    clips: project.clips.map((c) => ({
      order: c.order,
      filename: c.filename,
      duration: c.duration,
      notes: c.notes,
      visualObservation: c.visualObservation,
      commentary: c.commentary,
      transition: c.transition,
    })),
  };
  return JSON.stringify(cleanProject, null, 2);
}

/**
 * SRT subtitles formatted using clip durations
 */
export function exportAsSRT(project: VideoProject): string {
  const srtBlocks: string[] = [];
  let srtIndex = 1;
  let currentTime = 0;

  if (project.hookIntro) {
    const hookDuration = Math.max(3, project.hookIntro.split(' ').length * 0.4);
    srtBlocks.push(`${srtIndex++}`);
    srtBlocks.push(`${formatSrtTime(currentTime)} --> ${formatSrtTime(currentTime + hookDuration)}`);
    srtBlocks.push(project.hookIntro);
    srtBlocks.push('');
    currentTime += hookDuration;
  }

  project.clips.forEach((clip) => {
    const clipDuration = clip.duration || 6;
    const commentary = clip.commentary || '';
    const transition = clip.transition || '';

    if (commentary && transition) {
      // Split time between commentary and transition
      const commentaryDuration = clipDuration * 0.7;
      const transitionDuration = clipDuration * 0.3;

      srtBlocks.push(`${srtIndex++}`);
      srtBlocks.push(`${formatSrtTime(currentTime)} --> ${formatSrtTime(currentTime + commentaryDuration)}`);
      srtBlocks.push(commentary);
      srtBlocks.push('');
      currentTime += commentaryDuration;

      srtBlocks.push(`${srtIndex++}`);
      srtBlocks.push(`${formatSrtTime(currentTime)} --> ${formatSrtTime(currentTime + transitionDuration)}`);
      srtBlocks.push(transition);
      srtBlocks.push('');
      currentTime += transitionDuration;
    } else if (commentary || transition) {
      srtBlocks.push(`${srtIndex++}`);
      srtBlocks.push(`${formatSrtTime(currentTime)} --> ${formatSrtTime(currentTime + clipDuration)}`);
      srtBlocks.push(commentary || transition);
      srtBlocks.push('');
      currentTime += clipDuration;
    } else {
      currentTime += clipDuration;
    }
  });

  if (project.outro) {
    const outroDuration = Math.max(3, project.outro.split(' ').length * 0.4);
    srtBlocks.push(`${srtIndex++}`);
    srtBlocks.push(`${formatSrtTime(currentTime)} --> ${formatSrtTime(currentTime + outroDuration)}`);
    srtBlocks.push(project.outro);
    srtBlocks.push('');
  }

  return srtBlocks.join('\n');
}
