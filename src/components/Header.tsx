import React, { useState } from 'react';
import {
  Film,
  FolderOpen,
  Plus,
  Download,
  Scroll,
  FileText,
  FileCode,
  Subtitles,
  Check,
  Edit2,
  ListVideo,
  AlignLeft,
} from 'lucide-react';
import { VideoProject, ViewMode } from '../types';
import {
  exportAsText,
  exportAsMarkdown,
  exportAsJSON,
  exportAsSRT,
  downloadFile,
} from '../utils/exportHelpers';

interface HeaderProps {
  project: VideoProject;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  onNewProject: () => void;
  onOpenProjects: () => void;
  onOpenTeleprompter: () => void;
  onRenameProject: (newTitle: string) => void;
  saveStatus: 'saved' | 'saving' | 'unsaved';
}

export const Header: React.FC<HeaderProps> = ({
  project,
  viewMode,
  setViewMode,
  onNewProject,
  onOpenProjects,
  onOpenTeleprompter,
  onRenameProject,
  saveStatus,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(project.title);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState(false);

  const handleTitleSubmit = () => {
    if (titleDraft.trim()) {
      onRenameProject(titleDraft.trim());
    } else {
      setTitleDraft(project.title);
    }
    setIsEditingTitle(false);
  };

  const handleQuickCopy = async () => {
    const text = exportAsText(project);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedNotification(true);
      setTimeout(() => setCopiedNotification(false), 2000);
    } catch {
      // Fallback
    }
  };

  const totalClips = project.clips.length;
  const hasScript = Boolean(project.fullScript || project.clips.some((c) => c.commentary));

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/90 backdrop-blur-md px-4 sm:px-6 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand & Project Name */}
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-black shadow-md shadow-amber-500/20 font-display font-black text-base tracking-tighter">
              8
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center gap-1.5">
                <span className="font-display font-extrabold text-base tracking-tight text-white block leading-none">
                  8 MINUTES
                </span>
                <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Free
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium tracking-wide uppercase mt-0.5 block">
                Commentary Studio
              </span>
            </div>
          </div>

          <div className="h-5 w-[1px] bg-slate-800 hidden sm:block" />

          {/* Project Title Editor */}
          <div className="flex items-center gap-2 min-w-0">
            {isEditingTitle ? (
              <input
                type="text"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={handleTitleSubmit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTitleSubmit();
                  if (e.key === 'Escape') setIsEditingTitle(false);
                }}
                autoFocus
                className="bg-slate-900 border border-indigo-500/50 rounded-md px-2.5 py-1 text-sm text-slate-100 focus:outline-none max-w-[240px]"
              />
            ) : (
              <button
                onClick={() => {
                  setTitleDraft(project.title);
                  setIsEditingTitle(true);
                }}
                className="group flex items-center gap-1.5 text-sm font-medium text-slate-200 hover:text-white transition-colors truncate max-w-[180px] sm:max-w-[260px] text-left"
                title="Click to rename project"
              >
                <span className="truncate">{project.title || 'Untitled Video Project'}</span>
                <Edit2 className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-400 opacity-60 flex-shrink-0" />
              </button>
            )}

            {/* Save indicator */}
            <span className="text-[11px] text-slate-500 hidden md:inline-flex items-center gap-1">
              {saveStatus === 'saving' && <span className="animate-pulse text-indigo-400">Saving...</span>}
              {saveStatus === 'saved' && <span>Autosaved</span>}
            </span>
          </div>
        </div>

        {/* Center: View Switcher (Segmented Control) */}
        <div className="relative flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800/80 text-xs shadow-inner">
          <button
            onClick={() => setViewMode('clips')}
            className={`relative z-10 flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium transition-all ${
              viewMode === 'clips'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold shadow-md shadow-amber-500/20 scale-[1.02]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ListVideo className="w-3.5 h-3.5" />
            <span>Clip Editor</span>
            {totalClips > 0 && (
              <span className={`text-[10px] ml-0.5 px-1.5 py-0.2 rounded-full font-mono ${viewMode === 'clips' ? 'bg-black/20 text-black font-bold' : 'text-slate-400'}`}>
                {totalClips}
              </span>
            )}
          </button>
          <button
            onClick={() => setViewMode('fullScript')}
            className={`relative z-10 flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-medium transition-all ${
              viewMode === 'fullScript'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold shadow-md shadow-amber-500/20 scale-[1.02]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <AlignLeft className="w-3.5 h-3.5" />
            <span>Full Script</span>
          </button>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {/* Teleprompter Button */}
          {hasScript && (
            <button
              onClick={onOpenTeleprompter}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
              title="Launch teleprompter mode"
            >
              <Scroll className="w-3.5 h-3.5 text-amber-400" />
              <span>Teleprompter</span>
            </button>
          )}

          {/* Quick Copy All Scripts Button */}
          {hasScript && (
            <button
              onClick={handleQuickCopy}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-[0.98] ${
                copiedNotification
                  ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300 shadow-md shadow-emerald-950/50 scale-[1.02]'
                  : 'bg-slate-900/90 hover:bg-slate-800 text-slate-200 border-slate-700/80 shadow-sm hover:border-slate-600'
              }`}
              title="Copy entire continuous script to clipboard"
            >
              {copiedNotification ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline font-bold text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Copy All</span>
                </>
              )}
            </button>
          )}

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={!hasScript}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all active:scale-[0.98] ${
                hasScript
                  ? 'bg-slate-900/90 hover:bg-slate-800 text-slate-200 border-slate-700/80 hover:border-slate-600'
                  : 'bg-slate-950/40 text-slate-600 border-slate-900 cursor-not-allowed'
              }`}
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Export</span>
            </button>

            {showExportMenu && (
              <div
                className="absolute right-0 mt-2 w-56 rounded-lg bg-slate-900 border border-slate-800 shadow-xl py-1 z-50 text-xs"
                onMouseLeave={() => setShowExportMenu(false)}
              >
                <div className="px-3 py-1.5 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  Script Exports
                </div>

                <button
                  onClick={() => {
                    handleQuickCopy();
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-slate-200 hover:bg-slate-800 flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    Copy Plain Text
                  </span>
                  {copiedNotification && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </button>

                <button
                  onClick={() => {
                    downloadFile(exportAsText(project), `${project.title || 'script'}.txt`);
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  Download Plain Text (.txt)
                </button>

                <button
                  onClick={() => {
                    downloadFile(exportAsMarkdown(project), `${project.title || 'script'}.md`, 'text/markdown');
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                >
                  <FileText className="w-3.5 h-3.5 text-indigo-400" />
                  Download Structured Markdown (.md)
                </button>

                <button
                  onClick={() => {
                    downloadFile(exportAsSRT(project), `${project.title || 'subtitles'}.srt`, 'application/x-subrip');
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                >
                  <Subtitles className="w-3.5 h-3.5 text-amber-400" />
                  Download Subtitles (.srt)
                </button>

                <button
                  onClick={() => {
                    downloadFile(exportAsJSON(project), `${project.title || 'project'}.json`, 'application/json');
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                >
                  <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                  Download Project JSON (.json)
                </button>
              </div>
            )}
          </div>

          {/* Projects Button */}
          <button
            onClick={onOpenProjects}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-medium transition-colors"
            title="Saved projects"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Projects</span>
          </button>

          {/* New Project Button */}
          <button
            onClick={onNewProject}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-medium transition-colors"
            title="Create new project"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New</span>
          </button>
        </div>
      </div>
    </header>
  );
};
