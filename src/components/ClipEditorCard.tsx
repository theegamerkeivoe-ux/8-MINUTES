import React, { useState, useRef } from 'react';
import {
  Play,
  Pause,
  ArrowUp,
  ArrowDown,
  Trash2,
  RefreshCw,
  GitCommit,
  Check,
  Copy,
  Maximize2,
  Minimize2,
  RotateCcw,
  Sparkles,
  FileText,
} from 'lucide-react';
import { VideoClip } from '../types';
import { formatTime } from '../utils/exportHelpers';

interface ClipEditorCardProps {
  clip: VideoClip;
  index: number;
  totalClips: number;
  nextClipName?: string;
  onUpdateCommentary: (clipId: string, commentary: string) => void;
  onUpdateTransition: (clipId: string, transition: string) => void;
  onUpdateNotes: (clipId: string, notes: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onDelete: (clipId: string) => void;
  onReplaceFile: (clipId: string, file: File) => void;
  onRegenerateCommentary: (clipId: string, customInstruction?: string) => void;
  onRegenerateTransition: (clipId: string) => void;
  isRegenerating: boolean;
  isRegeneratingTransition: boolean;
  onNotify?: (message: string) => void;
}

export const ClipEditorCard: React.FC<ClipEditorCardProps> = ({
  clip,
  index,
  totalClips,
  nextClipName,
  onUpdateCommentary,
  onUpdateTransition,
  onUpdateNotes,
  onMoveUp,
  onMoveDown,
  onDelete,
  onReplaceFile,
  onRegenerateCommentary,
  onRegenerateTransition,
  isRegenerating,
  isRegeneratingTransition,
  onNotify,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showRegenPrompt, setShowRegenPrompt] = useState(false);
  const [regenInstruction, setRegenInstruction] = useState('');
  const [showNotes, setShowNotes] = useState(Boolean(clip.notes));
  const [videoExpanded, setVideoExpanded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  // Copy feedback states
  const [copiedFullClip, setCopiedFullClip] = useState(false);
  const [copiedCommentary, setCopiedCommentary] = useState(false);
  const [copiedTransition, setCopiedTransition] = useState(false);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleVideoEnded = () => {
    setIsPlaying(false);
  };

  const isFinalClip = index === totalClips - 1;

  // Copy helpers
  const handleCopyFullClip = async () => {
    const parts: string[] = [];
    if (clip.commentary?.trim()) parts.push(clip.commentary.trim());
    if (clip.transition?.trim()) parts.push(clip.transition.trim());
    const fullText = parts.join('\n\n');

    if (!fullText) return;
    try {
      await navigator.clipboard.writeText(fullText);
      setCopiedFullClip(true);
      onNotify?.(`Copied Clip #${index + 1} script to clipboard`);
      setTimeout(() => setCopiedFullClip(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleCopyCommentaryOnly = async () => {
    if (!clip.commentary?.trim()) return;
    try {
      await navigator.clipboard.writeText(clip.commentary.trim());
      setCopiedCommentary(true);
      onNotify?.(`Copied Clip #${index + 1} commentary to clipboard`);
      setTimeout(() => setCopiedCommentary(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleCopyTransitionOnly = async () => {
    if (!clip.transition?.trim()) return;
    try {
      await navigator.clipboard.writeText(clip.transition.trim());
      setCopiedTransition(true);
      onNotify?.(`Copied Clip #${index + 1} transition to clipboard`);
      setTimeout(() => setCopiedTransition(false), 2000);
    } catch {
      // fallback
    }
  };

  const commentaryWordCount = clip.commentary ? clip.commentary.split(/\s+/).filter(Boolean).length : 0;
  const transitionWordCount = clip.transition ? clip.transition.split(/\s+/).filter(Boolean).length : 0;

  return (
    <div className="group relative studio-card rounded-2xl p-5 transition-all duration-200 hover:border-slate-700 hover:shadow-xl hover:shadow-black/40">
      {/* Hidden File Input for Replace */}
      <input
        ref={replaceInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            onReplaceFile(clip.id, e.target.files[0]);
            e.target.value = '';
          }
        }}
      />

      {/* Top Header: Index, Filename, Duration, Copy Clip Button, Reorder & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-400 font-mono text-xs font-bold shadow-sm">
            {String(index + 1).padStart(2, '0')}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs sm:text-sm font-semibold text-slate-100 truncate max-w-[180px] sm:max-w-xs md:max-w-md tracking-tight font-display" title={clip.filename}>
              {clip.filename}
            </h4>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
              <span>{formatTime(clip.duration)}</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span>{commentaryWordCount + transitionWordCount} words</span>
            </div>
          </div>
        </div>

        {/* Action Controls & Copy */}
        <div className="flex items-center gap-1.5">
          {/* Copy Entire Clip Script Button */}
          <button
            type="button"
            onClick={handleCopyFullClip}
            disabled={!clip.commentary && !clip.transition}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              copiedFullClip
                ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                : 'bg-slate-950/80 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-700/70 disabled:opacity-30'
            }`}
            title="Copy commentary and transition for this clip"
          >
            {copiedFullClip ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[11px] font-semibold text-emerald-400">Copied Clip</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[11px]">Copy Clip</span>
              </>
            )}
          </button>

          <div className="h-4 w-[1px] bg-slate-800 mx-1" />

          {/* Reorder and Sequence Actions */}
          <button
            type="button"
            onClick={() => onMoveUp(index)}
            disabled={index === 0}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-25 disabled:hover:bg-transparent transition-colors"
            title="Move clip up in sequence"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onMoveDown(index)}
            disabled={index === totalClips - 1}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-25 disabled:hover:bg-transparent transition-colors"
            title="Move clip down in sequence"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => replaceInputRef.current?.click()}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Replace video footage with another file"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(clip.id)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
            title="Remove clip"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Grid: Video Preview on Left, Commentary & Transition on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Video Preview and Visual Evidence */}
        <div className={`${videoExpanded ? 'lg:col-span-12' : 'lg:col-span-4'} flex flex-col gap-3`}>
          <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800 aspect-video flex items-center justify-center group/vid shadow-inner">
            {clip.objectUrl ? (
              <>
                <video
                  ref={videoRef}
                  src={clip.objectUrl}
                  poster={clip.thumbnailUrl}
                  playsInline
                  onEnded={handleVideoEnded}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={togglePlay}
                  className="absolute inset-0 flex items-center justify-center bg-black/35 hover:bg-black/25 transition-colors"
                >
                  <div className="w-11 h-11 rounded-full bg-slate-900/90 border border-slate-700 flex items-center justify-center text-white shadow-xl backdrop-blur-md group-hover/vid:scale-105 transition-transform">
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setVideoExpanded(!videoExpanded)}
                  className="absolute bottom-2.5 right-2.5 p-1.5 rounded-md bg-slate-900/90 text-slate-300 hover:text-white border border-slate-700/80 text-xs backdrop-blur-md shadow-md"
                  title={videoExpanded ? 'Collapse video' : 'Expand video'}
                >
                  {videoExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
              </>
            ) : clip.thumbnailUrl ? (
              <img
                src={clip.thumbnailUrl}
                alt={clip.filename}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-slate-600 text-xs">No preview</div>
            )}
          </div>

          {/* Factual Visual Observation (What AI actually detected in the footage) */}
          {clip.visualObservation && (
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/90 text-xs">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 block mb-1">
                Visual Evidence
              </span>
              <p className="text-slate-300 text-xs leading-relaxed">
                {clip.visualObservation}
              </p>
            </div>
          )}

          {/* Optional Creator Notes */}
          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => setShowNotes(!showNotes)}
              className="text-slate-400 hover:text-slate-200 text-[11px] underline-offset-2 hover:underline transition-colors"
            >
              {showNotes ? 'Hide context notes' : '+ Add clip notes'}
            </button>
          </div>

          {showNotes && (
            <textarea
              value={clip.notes || ''}
              onChange={(e) => onUpdateNotes(clip.id, e.target.value)}
              placeholder="Provide extra details for this clip (e.g. 'Pay attention to the red car' or 'This happens at high speed')"
              rows={2}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
            />
          )}
        </div>

        {/* Right Column: Commentary and Transition Fields */}
        <div className={`${videoExpanded ? 'lg:col-span-12' : 'lg:col-span-8'} flex flex-col justify-between gap-3.5`}>
          {/* Main Commentary Field */}
          <div className="flex flex-col gap-1.5 flex-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-200 tracking-tight flex items-center gap-1.5 font-display">
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  Spoken Commentary
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  ({commentaryWordCount} words)
                </span>
              </div>

              {/* Action buttons: Copy Commentary & Regenerate */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCopyCommentaryOnly}
                  disabled={!clip.commentary?.trim()}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                    copiedCommentary
                      ? 'text-emerald-400 bg-emerald-950/60 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-30'
                  }`}
                  title="Copy this commentary only"
                >
                  {copiedCommentary ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Narration</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowRegenPrompt(!showRegenPrompt)}
                  disabled={isRegenerating}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-40 transition-colors"
                  title="Regenerate commentary for this clip"
                >
                  <RefreshCw className={`w-3 h-3 ${isRegenerating ? 'animate-spin text-amber-400' : ''}`} />
                  <span>{isRegenerating ? 'Rewriting...' : 'Regenerate'}</span>
                </button>
              </div>
            </div>

            {/* Optional Specific Guidance for Regeneration */}
            {showRegenPrompt && (
              <div className="flex items-center gap-2 p-2 rounded-xl bg-amber-950/30 border border-amber-900/50 mb-1">
                <input
                  type="text"
                  value={regenInstruction}
                  onChange={(e) => setRegenInstruction(e.target.value)}
                  placeholder="Optional prompt (e.g., 'Make it more suspenseful', 'Highlight the background detail')"
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    onRegenerateCommentary(clip.id, regenInstruction);
                    setShowRegenPrompt(false);
                    setRegenInstruction('');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold font-display"
                >
                  Rewrite
                </button>
              </div>
            )}

            <textarea
              value={clip.commentary || ''}
              onChange={(e) => onUpdateCommentary(clip.id, e.target.value)}
              placeholder="Generated commentary will appear here. You can edit any sentence freely."
              rows={4}
              className="script-textarea w-full bg-slate-950/90 border border-slate-800 focus:border-amber-500/70 rounded-xl p-4 text-[15px] leading-[1.8] text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500/20 transition-all resize-y font-normal"
            />
          </div>

          {/* Connective Transition Section */}
          <div className="p-4 rounded-xl bg-gradient-to-b from-[#091326]/80 to-[#070f1e]/90 border border-sky-500/20 shadow-inner flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium tracking-tight">
                <GitCommit className="w-3.5 h-3.5 text-sky-400" />
                <span className="font-semibold text-slate-200 font-display">
                  {isFinalClip ? 'Final Outro / Ending Bridge' : 'Transition to Next Clip'}
                </span>
                {!isFinalClip && nextClipName && (
                  <span className="text-slate-500 text-[11px] font-normal truncate max-w-[140px] sm:max-w-[200px]">
                    (leads to: {nextClipName})
                  </span>
                )}
                {transitionWordCount > 0 && (
                  <span className="text-[10px] font-mono text-slate-500 ml-1">
                    ({transitionWordCount} words)
                  </span>
                )}
              </div>

              {/* Action buttons: Copy Transition & Regenerate Transition */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCopyTransitionOnly}
                  disabled={!clip.transition?.trim()}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    copiedTransition
                      ? 'text-emerald-400 bg-emerald-950/60 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-30'
                  }`}
                  title="Copy this transition line only"
                >
                  {copiedTransition ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Transition</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => onRegenerateTransition(clip.id)}
                  disabled={isRegeneratingTransition}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] text-sky-300 hover:text-sky-200 hover:bg-sky-950/50 disabled:opacity-40 transition-colors"
                  title="Rewrite just this connective line to the next clip"
                >
                  <RefreshCw className={`w-3 h-3 ${isRegeneratingTransition ? 'animate-spin text-sky-400' : ''}`} />
                  <span>{isRegeneratingTransition ? 'Re-bridging...' : 'Regen Transition'}</span>
                </button>
              </div>
            </div>

            <textarea
              value={clip.transition || ''}
              onChange={(e) => onUpdateTransition(clip.id, e.target.value)}
              placeholder={
                isFinalClip
                  ? 'Closing concluding remarks...'
                  : 'Natural bridge leading to the next clip...'
              }
              rows={2}
              className="script-transition w-full bg-slate-900/60 border border-slate-800/80 focus:border-indigo-500/70 rounded-lg p-3 text-sm leading-[1.75] text-slate-200 italic focus:not-italic placeholder-slate-600 focus:outline-none transition-all resize-y font-normal"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
