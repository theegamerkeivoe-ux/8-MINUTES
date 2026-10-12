export interface VideoClip {
  id: string;
  file?: File;
  filename: string;
  fileSize: number;
  duration: number; // in seconds
  objectUrl?: string; // for local native video playback preview
  thumbnailUrl?: string; // extracted base64 image preview
  frames: string[]; // 1-3 extracted base64 frames for Gemini analysis
  order: number;
  notes?: string;
  status: 'idle' | 'extracting' | 'ready' | 'analyzing' | 'completed' | 'error';
  errorMessage?: string;

  // Generated AI commentary fields
  visualObservation?: string;
  commentary?: string;
  transition?: string;
  isCustomEdited?: boolean;
}

export interface VideoProject {
  id: string;
  title: string;
  topic: string;
  tone: string;
  targetAudience: string;
  hookIntro?: string;
  outro?: string;
  fullScript?: string;
  clips: VideoClip[];
  createdAt: string;
  updatedAt: string;
}

export type ViewMode = 'clips' | 'fullScript';

export interface TTSVoiceOption {
  id: string;
  name: string;
  description: string;
}
