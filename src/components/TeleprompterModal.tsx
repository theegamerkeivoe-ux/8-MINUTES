import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Play,
  Pause,
  RotateCcw,
  Sliders,
  FlipHorizontal,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

interface TeleprompterModalProps {
  isOpen: boolean;
  onClose: () => void;
  scriptText: string;
  topicTitle: string;
}

export const TeleprompterModal: React.FC<TeleprompterModalProps> = ({
  isOpen,
  onClose,
  scriptText,
  topicTitle,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(2); // 1 to 8
  const [fontSize, setFontSize] = useState(32); // px
  const [isMirrored, setIsMirrored] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setIsPlaying(false);
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      } else if (e.code === 'Escape') {
        onClose();
      } else if (e.code === 'ArrowUp') {
        setSpeed((s) => Math.min(8, s + 0.5));
      } else if (e.code === 'ArrowDown') {
        setSpeed((s) => Math.max(0.5, s - 0.5));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Smooth autoscroll loop
  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    let lastTimestamp = performance.now();

    const step = (timestamp: number) => {
      const delta = (timestamp - lastTimestamp) / 1000;
      lastTimestamp = timestamp;

      if (scrollContainerRef.current) {
        // speed factor: ~25px per second per speed unit
        scrollContainerRef.current.scrollTop += speed * 30 * delta;
      }

      animationFrameRef.current = requestAnimationFrame(step);
    };

    animationFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, speed]);

  if (!isOpen) return null;

  const resetScroll = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
    setIsPlaying(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col text-white select-none">
      {/* Top Floating Control Bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-neutral-950/90 border-b border-neutral-800 text-xs z-10 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <span className="font-display font-bold text-sm text-neutral-100 truncate max-w-sm">
            {topicTitle || '8 MINUTES Teleprompter'}
          </span>
          <span className="text-neutral-600 hidden sm:inline" aria-hidden="true">·</span>
          <span className="text-neutral-500 hidden sm:inline">Space: Play/Pause · Esc: Exit</span>
        </div>

        {/* Speed, Font, Mirror, Play Controls */}
        <div className="flex items-center gap-3">
          {/* Speed Controls */}
          <div className="flex items-center gap-1.5 bg-neutral-900 px-2.5 py-1 rounded-md border border-neutral-800">
            <span className="text-neutral-400 text-[11px]">Speed:</span>
            <span className="font-mono text-neutral-200 text-xs w-6 text-center">{speed.toFixed(1)}x</span>
            <button
              onClick={() => setSpeed((s) => Math.max(0.5, s - 0.5))}
              className="p-0.5 hover:text-white text-neutral-400"
              title="Slower"
            >
              -
            </button>
            <button
              onClick={() => setSpeed((s) => Math.min(8, s + 0.5))}
              className="p-0.5 hover:text-white text-neutral-400"
              title="Faster"
            >
              +
            </button>
          </div>

          {/* Font Size Controls */}
          <div className="flex items-center gap-1.5 bg-neutral-900 px-2.5 py-1 rounded-md border border-neutral-800">
            <span className="text-neutral-400 text-[11px]">Size:</span>
            <button
              onClick={() => setFontSize((f) => Math.max(20, f - 4))}
              className="px-1 hover:text-white text-neutral-400 text-xs"
            >
              A-
            </button>
            <button
              onClick={() => setFontSize((f) => Math.min(64, f + 4))}
              className="px-1 hover:text-white text-neutral-400 text-xs"
            >
              A+
            </button>
          </div>

          {/* Mirror Flip for Glass Hardware */}
          <button
            onClick={() => setIsMirrored(!isMirrored)}
            className={`p-1.5 rounded-md border transition-colors ${
              isMirrored
                ? 'bg-indigo-900/60 border-indigo-700 text-indigo-300'
                : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
            }`}
            title="Mirror horizontally for glass teleprompters"
          >
            <FlipHorizontal className="w-3.5 h-3.5" />
          </button>

          {/* Reset button */}
          <button
            onClick={resetScroll}
            className="p-1.5 rounded-md bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white transition-colors"
            title="Rewind to top"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Play / Pause Button */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium text-xs transition-colors ${
              isPlaying
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? 'Pause' : 'Start'}</span>
          </button>

          {/* Exit */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-md bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition-colors"
            title="Exit teleprompter"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Center Reading Focus Line */}
      <div className="pointer-events-none absolute left-0 right-0 top-1/3 h-[2px] bg-indigo-500/25 z-20 flex items-center justify-between px-6">
        <span className="text-[10px] font-mono uppercase text-indigo-400/50">Reading Guide</span>
        <span className="text-[10px] font-mono uppercase text-indigo-400/50">Reading Guide</span>
      </div>

      {/* Main Scrolling Text Area */}
      <div
        ref={scrollContainerRef}
        className={`flex-1 overflow-y-auto px-8 sm:px-24 py-32 transition-transform duration-200 ${
          isMirrored ? 'scale-x-[-1]' : ''
        }`}
        style={{ scrollBehavior: 'auto' }}
      >
        <div className="max-w-4xl mx-auto space-y-10 leading-[1.7] font-medium text-neutral-100 tracking-normal" style={{ fontSize: `${fontSize}px` }}>
          {scriptText.split('\n\n').map((paragraph, idx) => (
            <p key={idx} className="leading-[1.7]">
              {paragraph}
            </p>
          ))}
          {/* Bottom padding so the last line can scroll past the center line */}
          <div className="h-96" />
        </div>
      </div>
    </div>
  );
};
