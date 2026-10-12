import React, { useState } from 'react';
import { Sparkles, SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react';

interface TopicBarProps {
  topic: string;
  setTopic: (topic: string) => void;
  tone: string;
  setTone: (tone: string) => void;
  targetAudience: string;
  setTargetAudience: (audience: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  clipCount: number;
}

const TONE_OPTIONS = [
  'Conversational & Engaging (YouTube Creator)',
  'Investigative & Deep Dive (Documentary)',
  'Witty & Fast-Paced (Commentary & Reactions)',
  'Analytical & Technical (Breakdown)',
  'Dramatic & Suspenseful (High Stakes)',
  'Chill & Relaxed (Vlog style)',
];

export const TopicBar: React.FC<TopicBarProps> = ({
  topic,
  setTopic,
  tone,
  setTone,
  targetAudience,
  setTargetAudience,
  onGenerate,
  isGenerating,
  clipCount,
}) => {
  const [showOptions, setShowOptions] = useState(false);

  return (
    <div className="w-full bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-sm backdrop-blur-md">
      <div className="flex flex-col gap-3.5">
        {/* Main Topic Input Row */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="What is your video about? (e.g. How this climber escaped a sheer cliff drop, 5 insane speedrun glitches...)"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/40 transition-all font-normal"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowOptions(!showOptions)}
              className="flex items-center gap-1.5 px-3.5 py-3 rounded-xl bg-slate-950/80 hover:bg-slate-900 text-slate-300 hover:text-white border border-slate-800 text-xs font-medium transition-colors"
              title="Pacing, tone, and audience options"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline font-medium">Style & Tone</span>
              {showOptions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            <button
              type="button"
              onClick={onGenerate}
              disabled={isGenerating || clipCount === 0 || !topic.trim()}
              className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-display font-bold tracking-wide transition-all ${
                isGenerating || clipCount === 0 || !topic.trim()
                  ? 'bg-amber-500/20 text-amber-300/40 border border-amber-500/10 cursor-not-allowed'
                  : 'bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20 active:scale-[0.98]'
              }`}
            >
              <Sparkles className="w-4 h-4 fill-current" />
              <span>{isGenerating ? 'Synthesizing...' : `Generate Script (${clipCount})`}</span>
            </button>
          </div>
        </div>

        {/* Fine-Tuning Drawer */}
        {showOptions && (
          <div className="pt-3 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-slate-400 font-medium mb-1.5">Narration Tone & Persona</label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500/60"
              >
                {TONE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt} className="bg-slate-900 text-slate-200">
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1.5">Target Audience</label>
              <input
                type="text"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="e.g. YouTube viewers, Tech enthusiasts, Casual gamers"
                className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/60"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
