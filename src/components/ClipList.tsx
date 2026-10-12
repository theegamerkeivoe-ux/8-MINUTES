import React, { useState } from 'react';
import {
  GitCommit,
  Sparkles,
  RefreshCw,
  Layers,
  Clock,
  AlertCircle,
  Copy,
  Check,
  ChevronDown,
  FileText,
} from 'lucide-react';
import { VideoClip } from '../types';
import { ClipEditorCard } from './ClipEditorCard';
import { formatTime } from '../utils/exportHelpers';

interface ClipListProps {
  clips: VideoClip[];
  hookIntro?: string;
  outro?: string;
  onUpdateHook: (hook: string) => void;
  onUpdateOutro: (outro: string) => void;
  onUpdateCommentary: (clipId: string, commentary: string) => void;
  onUpdateTransition: (clipId: string, transition: string) => void;
  onUpdateNotes: (clipId: string, notes: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onDelete: (clipId: string) => void;
  onReplaceFile: (clipId: string, file: File) => void;
  onRegenerateCommentary: (clipId: string, customInstruction?: string) => void;
  onRegenerateTransition: (clipId: string) => void;
  onResequenceTransitions: () => void;
  isResequencing: boolean;
  activeRegeneratingClipId: string | null;
  activeRegeneratingTransitionClipId: string | null;
  hasReorderedWithoutResync: boolean;
  onNotify?: (message: string) => void;
}

const ITEMS_PER_PAGE = 20;

export const ClipList: React.FC<ClipListProps> = ({
  clips,
  hookIntro,
  outro,
  onUpdateHook,
  onUpdateOutro,
  onUpdateCommentary,
  onUpdateTransition,
  onUpdateNotes,
  onMoveUp,
  onMoveDown,
  onDelete,
  onReplaceFile,
  onRegenerateCommentary,
  onRegenerateTransition,
  onResequenceTransitions,
  isResequencing,
  activeRegeneratingClipId,
  activeRegeneratingTransitionClipId,
  hasReorderedWithoutResync,
  onNotify,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [showAllClips, setShowAllClips] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedHook, setCopiedHook] = useState(false);
  const [copiedOutro, setCopiedOutro] = useState(false);
  const [showCopyOptions, setShowCopyOptions] = useState(false);

  const totalDuration = clips.reduce((acc, c) => acc + (c.duration || 0), 0);
  const totalWords =
    clips.reduce((acc, c) => {
      const cWords = c.commentary ? c.commentary.split(/\s+/).filter(Boolean).length : 0;
      const tWords = c.transition ? c.transition.split(/\s+/).filter(Boolean).length : 0;
      return acc + cWords + tWords;
    }, 0) +
    (hookIntro ? hookIntro.split(/\s+/).filter(Boolean).length : 0) +
    (outro ? outro.split(/\s+/).filter(Boolean).length : 0);

  const totalPages = Math.ceil(clips.length / ITEMS_PER_PAGE);
  const displayedClips =
    showAllClips || clips.length <= ITEMS_PER_PAGE
      ? clips
      : clips.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Copy All functionality
  const handleCopyAll = async (format: 'continuous' | 'structured' = 'continuous') => {
    const lines: string[] = [];

    if (format === 'continuous') {
      if (hookIntro?.trim()) lines.push(hookIntro.trim());
      clips.forEach((c) => {
        if (c.commentary?.trim()) lines.push(c.commentary.trim());
        if (c.transition?.trim()) lines.push(c.transition.trim());
      });
      if (outro?.trim()) lines.push(outro.trim());
    } else {
      // Structured with headings and timestamps
      if (hookIntro?.trim()) {
        lines.push(`[INTRO HOOK]\n${hookIntro.trim()}\n`);
      }
      let cumulativeTime = 0;
      clips.forEach((c, idx) => {
        lines.push(`[CLIP ${idx + 1} (${formatTime(cumulativeTime)}): ${c.filename}]`);
        if (c.commentary?.trim()) lines.push(c.commentary.trim());
        if (c.transition?.trim()) lines.push(`-> Transition: ${c.transition.trim()}`);
        lines.push('');
        cumulativeTime += c.duration || 5;
      });
      if (outro?.trim()) {
        lines.push(`[OUTRO]\n${outro.trim()}`);
      }
    }

    const fullText = lines.join('\n\n');
    if (!fullText.trim()) return;

    try {
      await navigator.clipboard.writeText(fullText);
      setCopiedAll(true);
      onNotify?.('Copied all scripts to clipboard!');
      setShowCopyOptions(false);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleCopyHook = async () => {
    if (!hookIntro?.trim()) return;
    try {
      await navigator.clipboard.writeText(hookIntro.trim());
      setCopiedHook(true);
      onNotify?.('Copied Opening Hook to clipboard');
      setTimeout(() => setCopiedHook(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleCopyOutro = async () => {
    if (!outro?.trim()) return;
    try {
      await navigator.clipboard.writeText(outro.trim());
      setCopiedOutro(true);
      onNotify?.('Copied Concluding Outro to clipboard');
      setTimeout(() => setCopiedOutro(false), 2000);
    } catch {
      // Fallback
    }
  };

  const hasAnyCommentary = Boolean(
    hookIntro || outro || clips.some((c) => c.commentary || c.transition)
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Sequence Overview Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/40 border border-slate-800/80 rounded-xl px-4 py-3 text-xs">
        <div className="flex items-center gap-3 text-slate-400">
          <div className="flex items-center gap-1.5 font-medium text-slate-200">
            <Layers className="w-4 h-4 text-indigo-400" />
            <span className="font-semibold">{clips.length} {clips.length === 1 ? 'Clip' : 'Clips'}</span>
          </div>
          <span className="text-slate-700" aria-hidden="true">·</span>
          <div className="flex items-center gap-1.5 font-mono text-slate-300">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Total Duration: {formatTime(totalDuration)}</span>
          </div>
          <span className="text-slate-700 hidden sm:inline" aria-hidden="true">·</span>
          <span className="text-slate-300 font-mono hidden sm:inline">
            ~{totalWords} words (~{Math.round((totalWords / 140) * 10) / 10} min read)
          </span>
        </div>

        {/* Action Controls: Copy All Scripts & Resync Transitions */}
        <div className="flex items-center gap-2">
          {hasReorderedWithoutResync && (
            <div className="flex items-center gap-1.5 text-amber-300 text-xs bg-amber-950/40 border border-amber-900/50 px-2.5 py-1 rounded-md">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>Clips reordered</span>
            </div>
          )}

          {/* Copy All Scripts Dropdown / Button */}
          <div className="relative">
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => handleCopyAll('continuous')}
                disabled={!hasAnyCommentary}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-l-xl text-xs font-semibold border transition-all ${
                  copiedAll
                    ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                    : 'bg-amber-500 hover:bg-amber-400 text-black border-amber-500/80 shadow-md shadow-amber-500/15 disabled:opacity-40 disabled:bg-slate-800 disabled:border-slate-700 disabled:text-slate-400'
                }`}
                title="Copy all generated scripts into clipboard"
              >
                {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 fill-current" />}
                <span>{copiedAll ? 'All Copied!' : 'Copy All Scripts'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowCopyOptions(!showCopyOptions)}
                disabled={!hasAnyCommentary}
                className={`px-2 py-1.5 rounded-r-xl border-y border-r text-xs transition-all ${
                  copiedAll
                    ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                    : 'bg-amber-500 hover:bg-amber-400 text-black border-amber-500/80 disabled:opacity-40 disabled:bg-slate-800 disabled:border-slate-700 disabled:text-slate-400'
                }`}
                title="Copy formatting options"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {showCopyOptions && (
              <div
                className="absolute right-0 mt-2 w-56 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl py-1 z-50 text-xs"
                onMouseLeave={() => setShowCopyOptions(false)}
              >
                <button
                  onClick={() => handleCopyAll('continuous')}
                  className="w-full text-left px-3.5 py-2 text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                >
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  <span>Continuous Narration Only</span>
                </button>
                <button
                  onClick={() => handleCopyAll('structured')}
                  className="w-full text-left px-3.5 py-2 text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                >
                  <Layers className="w-3.5 h-3.5 text-amber-400" />
                  <span>With Timestamps & Clip Cues</span>
                </button>
              </div>
            )}
          </div>

          {/* Resync Transitions Button */}
          {clips.length > 1 && (
            <button
              type="button"
              onClick={onResequenceTransitions}
              disabled={isResequencing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700/80 text-xs font-medium transition-colors"
              title="Automatically refresh all transitions between clips to match the current order"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isResequencing ? 'animate-spin' : ''}`} />
              <span>{isResequencing ? 'Updating Transitions...' : 'Re-sync Transitions'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Opening Hook Card */}
      {(hookIntro !== undefined || clips.some((c) => c.commentary)) && (
        <div className="bg-slate-900/50 border border-amber-950/40 rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <span className="font-display text-xs font-bold text-amber-300 flex items-center gap-1.5 tracking-tight uppercase">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Opening Hook & Video Intro
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                (Plays before Clip 1)
              </span>
            </div>

            {/* Copy Intro Hook Button */}
            <button
              type="button"
              onClick={handleCopyHook}
              disabled={!hookIntro?.trim()}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                copiedHook
                  ? 'text-emerald-400 bg-emerald-950/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-30'
              }`}
              title="Copy opening hook text"
            >
              {copiedHook ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[11px] font-semibold text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Copy Hook</span>
                </>
              )}
            </button>
          </div>
          <textarea
            value={hookIntro || ''}
            onChange={(e) => onUpdateHook(e.target.value)}
            placeholder="High-energy opening hook introducing the premise before the first clip..."
            rows={2}
            className="script-textarea w-full bg-slate-950/90 border border-slate-800 focus:border-indigo-500/70 rounded-xl p-4 text-[15px] leading-[1.8] text-slate-100 placeholder-slate-600 focus:outline-none"
          />
        </div>
      )}

      {/* Pagination Bar for Projects with > 20 clips */}
      {clips.length > ITEMS_PER_PAGE && (
        <div className="flex items-center justify-between bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-2.5 text-xs">
          <span className="text-slate-400">
            Showing clips {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, clips.length)} of {clips.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAllClips(!showAllClips)}
              className="px-2.5 py-1 text-slate-400 hover:text-white underline text-[11px]"
            >
              {showAllClips ? 'Enable Pagination' : 'Show All Clips'}
            </button>
            {!showAllClips && (
              <div className="flex items-center gap-1">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1 rounded bg-slate-800 disabled:opacity-30 text-slate-300"
                >
                  Prev
                </button>
                <span className="px-2 text-slate-400">{currentPage} / {totalPages}</span>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-2.5 py-1 rounded bg-slate-800 disabled:opacity-30 text-slate-300"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Clip Cards List */}
      <div className="flex flex-col gap-5">
        {displayedClips.map((clip, idx) => {
          const globalIndex =
            showAllClips || clips.length <= ITEMS_PER_PAGE
              ? idx
              : (currentPage - 1) * ITEMS_PER_PAGE + idx;
          const nextClip = clips[globalIndex + 1];

          return (
            <ClipEditorCard
              key={clip.id}
              clip={clip}
              index={globalIndex}
              totalClips={clips.length}
              nextClipName={nextClip?.filename}
              onUpdateCommentary={onUpdateCommentary}
              onUpdateTransition={onUpdateTransition}
              onUpdateNotes={onUpdateNotes}
              onMoveUp={onMoveUp}
              onMoveDown={onMoveDown}
              onDelete={onDelete}
              onReplaceFile={onReplaceFile}
              onRegenerateCommentary={onRegenerateCommentary}
              onRegenerateTransition={onRegenerateTransition}
              isRegenerating={activeRegeneratingClipId === clip.id}
              isRegeneratingTransition={activeRegeneratingTransitionClipId === clip.id}
              onNotify={onNotify}
            />
          );
        })}
      </div>

      {/* Concluding Outro Card */}
      {(outro !== undefined || clips.some((c) => c.commentary)) && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm mt-1">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 tracking-tight">
                <GitCommit className="w-3.5 h-3.5 text-indigo-400" />
                Final Video Outro & Conclusion
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                (Plays after final clip)
              </span>
            </div>

            {/* Copy Outro Button */}
            <button
              type="button"
              onClick={handleCopyOutro}
              disabled={!outro?.trim()}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                copiedOutro
                  ? 'text-emerald-400 bg-emerald-950/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-30'
              }`}
              title="Copy outro text"
            >
              {copiedOutro ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[11px] font-semibold text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Copy Outro</span>
                </>
              )}
            </button>
          </div>
          <textarea
            value={outro || ''}
            onChange={(e) => onUpdateOutro(e.target.value)}
            placeholder="Closing takeaway, question for the audience, or call-to-action..."
            rows={2}
            className="script-textarea w-full bg-slate-950/90 border border-slate-800 focus:border-indigo-500/70 rounded-xl p-4 text-[15px] leading-[1.8] text-slate-100 placeholder-slate-600 focus:outline-none"
          />
        </div>
      )}
    </div>
  );
};
