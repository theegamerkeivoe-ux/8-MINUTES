import React, { useRef, useState } from 'react';
import { UploadCloud, Plus, Loader2 } from 'lucide-react';

interface ClipUploadZoneProps {
  onFilesSelected: (files: FileList | File[]) => void;
  isProcessingUploads: boolean;
  uploadProgressText?: string;
  hasClips: boolean;
}

export const ClipUploadZone: React.FC<ClipUploadZoneProps> = ({
  onFilesSelected,
  isProcessingUploads,
  uploadProgressText,
  hasClips,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(e.dataTransfer.files);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(e.target.files);
      // Reset input value so re-selecting same file works
      e.target.value = '';
    }
  };

  if (hasClips) {
    // Compact "Add More Clips" bar when clips already exist
    return (
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
          isDragOver
            ? 'border-indigo-500 bg-indigo-950/20'
            : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="video/*"
          className="hidden"
          onChange={handleInputChange}
        />

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-slate-800 flex items-center justify-center text-slate-300">
            <UploadCloud className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-200">
              Drag & drop more clips here, or add from your computer
            </p>
            <p className="text-[11px] text-slate-500">
              MP4, WebM, MOV · No clip limits
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isProcessingUploads && (
            <div className="flex items-center gap-1.5 text-xs text-indigo-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>{uploadProgressText || 'Extracting frames...'}</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessingUploads}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Clips</span>
          </button>
        </div>
      </div>
    );
  }

  // Full-width initial drop area for empty state
  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      className={`cursor-pointer group flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 sm:p-12 transition-all ${
        isDragOver
          ? 'border-indigo-500 bg-indigo-950/20 shadow-lg shadow-indigo-950/40'
          : 'border-slate-800 hover:border-slate-700 bg-slate-900/30 hover:bg-slate-900/50'
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="video/*"
        className="hidden"
        onChange={handleInputChange}
      />

      <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-700/80 flex items-center justify-center text-amber-400 mb-4 group-hover:scale-105 transition-transform shadow-lg shadow-black/40">
        {isProcessingUploads ? (
          <Loader2 className="w-7 h-7 animate-spin text-amber-400" />
        ) : (
          <UploadCloud className="w-7 h-7" />
        )}
      </div>

      <h3 className="font-display text-base font-bold text-slate-100 mb-1 tracking-tight">
        {isProcessingUploads ? 'Analyzing video footage...' : 'Drop your video clips here'}
      </h3>

      <p className="text-xs text-slate-400 max-w-md text-center mb-4 leading-relaxed">
        {isProcessingUploads
          ? uploadProgressText || 'Decoding keyframes and video duration...'
          : 'Upload clips for your commentary video. 8 MINUTES will analyze the action, connect the dots, and craft a continuous narration.'}
      </p>

      <div className="flex items-center gap-3 text-[11px] text-slate-500">
        <span>MP4, MOV, WebM</span>
        <span aria-hidden="true">·</span>
        <span>Unlimited clips</span>
        <span aria-hidden="true">·</span>
        <span>Reorder anytime</span>
      </div>
    </div>
  );
};
