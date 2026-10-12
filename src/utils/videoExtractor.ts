/**
 * Client-side video metadata and frame extractor.
 * Decodes video using HTML5 Video and Offscreen/Standard Canvas to capture keyframe stills for Gemini visual analysis.
 */

export interface ExtractedVideoData {
  duration: number;
  thumbnailUrl: string;
  frames: string[];
  width: number;
  height: number;
}

export async function extractVideoData(file: File): Promise<ExtractedVideoData> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;

    // Timeout safety net (5 seconds max per clip extraction)
    const timeout = setTimeout(() => {
      cleanup();
      resolve({
        duration: 0,
        thumbnailUrl: createPlaceholderThumbnail(file.name),
        frames: [],
        width: 1280,
        height: 720,
      });
    }, 6000);

    const cleanup = () => {
      clearTimeout(timeout);
      video.removeAttribute('src');
      video.load();
    };

    video.onloadedmetadata = async () => {
      try {
        const duration = isFinite(video.duration) && video.duration > 0 ? video.duration : 5;
        const width = video.videoWidth || 1280;
        const height = video.videoHeight || 720;

        // Determine seek timestamps: 15%, 50%, 80% (or min 0.5s)
        const timestamps = [
          Math.min(1.0, duration * 0.15),
          duration * 0.5,
          Math.max(duration * 0.8, duration - 1.0),
        ];

        // Deduplicate timestamps if video is very short
        const uniqueTimestamps = Array.from(new Set(timestamps.map((t) => Math.max(0.1, Math.min(t, duration - 0.1)))));

        const frames: string[] = [];
        let primaryThumbnail = '';

        for (let i = 0; i < uniqueTimestamps.length; i++) {
          const time = uniqueTimestamps[i];
          try {
            const frameBase64 = await captureFrameAtTime(video, time, width, height);
            if (frameBase64) {
              frames.push(frameBase64);
              if (!primaryThumbnail) {
                primaryThumbnail = frameBase64;
              }
            }
          } catch (e) {
            console.warn(`Could not capture frame at ${time}s for ${file.name}`, e);
          }
        }

        cleanup();

        resolve({
          duration: Math.round(duration * 10) / 10,
          thumbnailUrl: primaryThumbnail || createPlaceholderThumbnail(file.name),
          frames: frames.length > 0 ? frames : [createPlaceholderThumbnail(file.name)],
          width,
          height,
        });
      } catch (err) {
        console.error('Error during video extraction:', err);
        cleanup();
        resolve({
          duration: 0,
          thumbnailUrl: createPlaceholderThumbnail(file.name),
          frames: [],
          width: 1280,
          height: 720,
        });
      }
    };

    video.onerror = () => {
      cleanup();
      resolve({
        duration: 0,
        thumbnailUrl: createPlaceholderThumbnail(file.name),
        frames: [],
        width: 1280,
        height: 720,
      });
    };
  });
}

function captureFrameAtTime(
  video: HTMLVideoElement,
  time: number,
  originalWidth: number,
  originalHeight: number
): Promise<string> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);

      try {
        // Target an optimized analysis resolution (e.g. max width 640px)
        const targetWidth = Math.min(640, originalWidth);
        const scale = targetWidth / originalWidth;
        const targetHeight = Math.round(originalHeight * scale);

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
          // 0.8 quality jpeg is compact (~35KB) and crystal clear for Gemini vision
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          resolve(dataUrl);
        } else {
          resolve('');
        }
      } catch (err) {
        console.warn('Canvas draw failed:', err);
        resolve('');
      }
    };

    video.addEventListener('seeked', onSeeked, { once: true });
    video.currentTime = time;
  });
}

function createPlaceholderThumbnail(filename: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 270;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 480, 270);
    ctx.fillStyle = '#334155';
    ctx.fillRect(20, 20, 440, 230);
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(filename.slice(0, 24), 240, 135);
    return canvas.toDataURL('image/jpeg', 0.7);
  }
  return '';
}
