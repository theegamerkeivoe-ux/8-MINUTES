import React, { useState, useEffect } from 'react';
import {
  Copy,
  Check,
  Download,
  Scroll,
  Volume2,
  VolumeX,
  Sparkles,
  Loader2,
  Play,
  Square,
  FileText,
  Clock,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { VideoProject } from '../types';
import { exportAsText, exportAsMarkdown, downloadFile, formatTime } from '../utils/exportHelpers';

interface FullScriptViewProps {
  project: VideoProject;
  onUpdateFullScript: (script: string) => void;
  onPolishScript: () => void;
  isPolishing: boolean;
  onOpenTeleprompter: () => void;
  onNotify?: (message: string) => void;
}

export const FullScriptView: React.FC<FullScriptViewProps> = ({
  project,
  onUpdateFullScript,
  onPolishScript,
  isPolishing,
  onOpenTeleprompter,
  onNotify,
}) => {
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedSectionId, setCopiedSectionId] = useState<string | null>(null);
  const [scriptSubView, setScriptSubView] = useState<'continuous' | 'segmented'>('continuous');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isGeneratingTTS, setIsGeneratingTTS] = useState(false);
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [selectedVoice, setSelectedVoice] = useState('Zephyr');

  const continuousScript = project.fullScript || exportAsText(project);
  const wordsCount = continuousScript.split(/\s+/).filter(Boolean).length;
  const estimatedMinutes = Math.round((wordsCount / 140) * 10) / 10;

  const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(continuousScript);
      setCopiedAll(true);
      onNotify?.('Copied complete script to clipboard!');
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleCopySection = async (sectionId: string, text: string, label: string) => {
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text.trim());
      setCopiedSectionId(sectionId);
      onNotify?.(`Copied ${label} to clipboard!`);
      setTimeout(() => setCopiedSectionId(null), 2000);
    } catch {
      // Fallback
    }
  };

  const handlePlayVoice = async () => {
    if (isPlayingAudio && audioElement) {
      audioElement.pause();
      setIsPlayingAudio(false);
      return;
    }

    if (ttsAudioUrl) {
      const audio = new Audio(ttsAudioUrl);
      setAudioElement(audio);
      audio.onended = () => setIsPlayingAudio(false);
      audio.play();
      setIsPlayingAudio(true);
      return;
    }

    // Call server Gemini TTS endpoint
    try {
      setIsGeneratingTTS(true);
      const res = await fetch('/api/generate-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: continuousScript,
          voice: selectedVoice,
        }),
      });

      const data = await res.json();
      if (data.audioData) {
        setTtsAudioUrl(data.audioData);
        const audio = new Audio(data.audioData);
        setAudioElement(audio);
        audio.onended = () => setIsPlayingAudio(false);
        audio.play();
        setIsPlayingAudio(true);
      } else {
        // Fallback to browser Web Speech API
        speakWithBrowser(continuousScript);
      }
    } catch (err) {
      console.warn('TTS server failed, using browser speech:', err);
      speakWithBrowser(continuousScript);
    } finally {
      setIsGeneratingTTS(false);
    }
  };

  const speakWithBrowser = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.onend = () => setIsPlayingAudio(false);
      window.speechSynthesis.speak(utterance);
      setIsPlayingAudio(true);
    }
  };

  const stopAudio = () => {
    if (audioElement) {
      audioElement.pause();
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlayingAudio(false);
  };

  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);

  return (
    <div className="flex flex-col gap-5 max-w-5xl mx-auto w-full">
      {/* Control & Statistics Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 rounded-2xl p-4 shadow-sm text-xs">
        {/* Left: View Mode Toggle & Metrics */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setScriptSubView('continuous')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                scriptSubView === 'continuous'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Continuous Text
            </button>
            <button
              onClick={() => setScriptSubView('segmented')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                scriptSubView === 'segmented'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Segmented by Clip
            </button>
          </div>

          <div className="h-4 w-[1px] bg-slate-800 hidden sm:block" />

          <div className="hidden sm:flex items-center gap-2 font-mono text-slate-300">
            <span>{wordsCount} words</span>
            <span className="text-slate-700">·</span>
            <div className="flex items-center gap-1 text-slate-300">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>~{estimatedMinutes} min read</span>
            </div>
          </div>
        </div>

        {/* Right Action Controls: TTS audio, Polish, Copy All, Teleprompter */}
        <div className="flex flex-wrap items-center gap-2">
          {/* TTS Audio narration */}
          <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
            <select
              value={selectedVoice}
              onChange={(e) => {
                setSelectedVoice(e.target.value);
                setTtsAudioUrl(null);
              }}
              className="bg-transparent text-[11px] text-slate-300 focus:outline-none pr-1"
            >
              <option value="Zephyr" className="bg-slate-900">Voice: Zephyr</option>
              <option value="Puck" className="bg-slate-900">Voice: Puck</option>
              <option value="Kore" className="bg-slate-900">Voice: Kore</option>
              <option value="Fenrir" className="bg-slate-900">Voice: Fenrir</option>
              <option value="Charon" className="bg-slate-900">Voice: Charon</option>
            </select>
            <button
              type="button"
              onClick={isPlayingAudio ? stopAudio : handlePlayVoice}
              disabled={isGeneratingTTS || !continuousScript.trim()}
              className="flex items-center gap-1 text-[11px] font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              {isGeneratingTTS ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : isPlayingAudio ? (
                <>
                  <Square className="w-3 h-3 fill-current" />
                  <span>Stop</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 fill-current" />
                  <span>Listen</span>
                </>
              )}
            </button>
          </div>

          {/* Polish Script Button */}
          <button
            type="button"
            onClick={onPolishScript}
            disabled={isPolishing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
            title="Harmonize transitions and eliminate awkward repetition"
          >
            <Sparkles className={`w-3.5 h-3.5 text-indigo-400 ${isPolishing ? 'animate-spin' : ''}`} />
            <span>{isPolishing ? 'Polishing...' : 'Polish Script'}</span>
          </button>

          {/* Copy All Scripts Button */}
          <button
            type="button"
            onClick={handleCopyAll}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              copiedAll
                ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                : 'bg-amber-500 hover:bg-amber-400 text-black border-amber-500/80 shadow-md shadow-amber-500/15'
            }`}
          >
            {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 fill-current" />}
            <span>{copiedAll ? 'All Copied!' : 'Copy All'}</span>
          </button>

          {/* Teleprompter Button */}
          <button
            type="button"
            onClick={onOpenTeleprompter}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
          >
            <Scroll className="w-3.5 h-3.5 text-indigo-400" />
            <span>Teleprompter</span>
          </button>
        </div>
      </div>

      {/* Main View Area */}
      {scriptSubView === 'continuous' ? (
        /* Continuous Editable Teleprompter Area */
        <div className="relative rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-10 shadow-sm backdrop-blur-sm">
          <textarea
            value={continuousScript}
            onChange={(e) => onUpdateFullScript(e.target.value)}
            placeholder="Continuous narration script will appear here..."
            rows={22}
            className="script-master w-full bg-transparent text-slate-100 text-base sm:text-[17px] leading-[1.88] focus:outline-none resize-y font-normal tracking-normal placeholder-slate-600"
            spellCheck={false}
          />
        </div>
      ) : (
        /* Segmented Clip Breakdown with Individual Copy Buttons */
        <div className="flex flex-col gap-4">
          {/* Opening Hook Section */}
          {project.hookIntro && (
            <div className="bg-slate-900/50 border border-indigo-950/70 rounded-2xl p-4 sm:p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5 tracking-tight">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  Opening Hook
                </span>
                <button
                  type="button"
                  onClick={() => handleCopySection('hook', project.hookIntro || '', 'Opening Hook')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  {copiedSectionId === 'hook' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400 font-semibold">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Hook</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-[15px] sm:text-base text-slate-100 leading-[1.8] font-normal">
                {project.hookIntro}
              </p>
            </div>
          )}

          {/* Each Clip Section */}
          {project.clips.map((clip, idx) => {
            const clipText = [clip.commentary, clip.transition].filter(Boolean).join('\n\n');
            const clipSectionId = `clip_${clip.id}`;

            return (
              <div
                key={clip.id}
                className="bg-slate-900/50 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-4 sm:p-6 transition-all"
              >
                <div className="flex items-center justify-between mb-3.5 pb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-md bg-indigo-950/60 border border-indigo-900/50 flex items-center justify-center text-xs font-mono font-bold text-indigo-400">
                      {idx + 1}
                    </span>
                    <span className="text-xs sm:text-sm font-semibold text-slate-200 truncate max-w-xs tracking-tight">
                      {clip.filename}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">
                      ({formatTime(clip.duration)})
                    </span>
                  </div>

                  {/* Copy Individual Clip Button */}
                  <div className="flex items-center gap-1.5">
                    {clip.commentary && (
                      <button
                        type="button"
                        onClick={() => handleCopySection(`com_${clip.id}`, clip.commentary || '', `Clip #${idx + 1} Commentary`)}
                        className="px-2 py-1 rounded text-[11px] text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                      >
                        {copiedSectionId === `com_${clip.id}` ? 'Copied Narration' : 'Copy Narration'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleCopySection(clipSectionId, clipText, `Clip #${idx + 1} Script`)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                        copiedSectionId === clipSectionId
                          ? 'text-emerald-400 bg-emerald-950/40'
                          : 'text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700'
                      }`}
                    >
                      {copiedSectionId === clipSectionId ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="font-semibold">Copied Clip</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                          <span>Copy Clip #{idx + 1}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Clip Content */}
                <div className="space-y-3.5">
                  {clip.commentary && (
                    <p className="text-[15px] sm:text-base text-slate-100 leading-[1.8] font-normal">
                      {clip.commentary}
                    </p>
                  )}
                  {clip.transition && (
                    <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 text-sm text-slate-200 italic leading-[1.75]">
                      <span className="not-italic text-[10px] uppercase font-mono text-indigo-400 block mb-1">
                        Transition
                      </span>
                      {clip.transition}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Concluding Outro Section */}
          {project.outro && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 sm:p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 tracking-tight">
                  Concluding Outro
                </span>
                <button
                  type="button"
                  onClick={() => handleCopySection('outro', project.outro || '', 'Outro')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  {copiedSectionId === 'outro' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400 font-semibold">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Outro</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-[15px] sm:text-base text-slate-100 leading-[1.8] font-normal">
                {project.outro}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Quick Download Links */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-2 pt-2">
        <span>Ready for voice recording, teleprompters, or video timeline markers.</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => downloadFile(continuousScript, `${project.title || 'script'}.txt`)}
            className="text-slate-300 hover:text-white underline-offset-2 hover:underline transition-colors"
          >
            Download .txt
          </button>
          <span className="text-slate-700" aria-hidden="true">·</span>
          <button
            onClick={() => downloadFile(exportAsMarkdown(project), `${project.title || 'script'}.md`, 'text/markdown')}
            className="text-slate-300 hover:text-white underline-offset-2 hover:underline transition-colors"
          >
            Download .md
          </button>
        </div>
      </div>
    </div>
  );
};
