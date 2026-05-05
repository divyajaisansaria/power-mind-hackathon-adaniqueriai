"use client"

import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Headphones, FileText, Play, Pause, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';
import { generatePodcastAction } from '@/lib/actions';

// ── Mic Pulsing Loader ────────────────────────────────────────────────────────
function MicLoadingState() {
  return (
    <div className="flex flex-col items-center justify-center h-full space-y-8 py-12 px-6">
      <div className="relative flex items-center justify-center">
        <div className="absolute w-36 h-36 rounded-full border border-purple-500/10 animate-ping" style={{ animationDuration: '3s' }} />
        <div className="absolute w-28 h-28 rounded-full border border-purple-500/20 animate-ping" style={{ animationDuration: '2.2s' }} />
        <div className="absolute w-20 h-20 bg-purple-500/10 rounded-full animate-pulse" style={{ animationDuration: '1.5s' }} />
        <div
          className="relative w-16 h-16 bg-gradient-to-br from-purple-600 to-purple-900 rounded-full flex items-center justify-center shadow-2xl shadow-purple-500/40 z-10"
          style={{ animation: 'micPulse 2s ease-in-out infinite' }}>
          <Mic className="w-7 h-7 text-white" />
        </div>
      </div>
      <div className="text-center space-y-2">
        <p className="text-sm font-bold text-foreground">Generating Podcast...</p>
        <p className="text-xs text-muted-foreground max-w-[180px] mx-auto leading-relaxed">
          Writing script and synthesizing<br />2 voices. This takes ~30s.
        </p>
      </div>
      <div className="flex items-end gap-1 h-8">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i}
            className="w-1.5 bg-purple-500 rounded-full"
            style={{
              animation: `barBounce 0.8s ease-in-out infinite`,
              animationDelay: `${i * 0.07}s`,
              minHeight: '4px',
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes micPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 20px rgba(168,85,247,0.3); }
          50%       { transform: scale(1.08); box-shadow: 0 0 40px rgba(168,85,247,0.6); }
        }
        @keyframes barBounce {
          0%, 100% { height: 4px;  opacity: 0.4; }
          50%       { height: 28px; opacity: 0.9; }
        }
      `}</style>
    </div>
  );
}

// ── Centred Waveform Player ───────────────────────────────────────────────────
function WaveformPlayer({ audioBase64, script }: { audioBase64: string; script: string | null }) {
  const audioRef   = useRef<HTMLAudioElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const animRef    = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const phaseRef   = useRef(0);

  const [isPlaying,    setIsPlaying]    = useState(false);
  const [currentTime,  setCurrentTime]  = useState(0);
  const [duration,     setDuration]     = useState(0);

  const src = `data:audio/wav;base64,${audioBase64}`;

  useEffect(() => {
    drawIdle();
    return () => {
      cancelAnimationFrame(animRef.current);
      audioCtxRef.current?.close();
    };
  }, [audioBase64]);

  /* ── setup Web Audio ── */
  const setupAnalyser = () => {
    if (analyserRef.current || !audioRef.current) return;
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioCtxRef.current = ctx;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyserRef.current = analyser;
    ctx.createMediaElementSource(audioRef.current)
      .connect(analyser);
    analyser.connect(ctx.destination);
  };

  /* ── idle static wave ── */
  const drawIdle = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width, H = canvas.height, cy = H / 2;
    ctx.clearRect(0, 0, W, H);

    // soft centre horizontal line
    ctx.save();
    ctx.strokeStyle = 'rgba(168,85,247,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy);
    ctx.stroke();
    ctx.restore();

    // static sine preview
    const drawStaticWave = (color: string, ampFrac: number, freq: number, phaseOffset: number) => {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      for (let i = 0; i <= W; i++) {
        const y = cy + Math.sin((i / W) * Math.PI * freq + phaseOffset) * cy * ampFrac
                     * Math.sin((i / W) * Math.PI);
        if (i === 0) ctx.moveTo(i, y); else ctx.lineTo(i, y);
      }
      ctx.stroke();
      ctx.restore();
    };
    drawStaticWave('rgba(168,85,247,1)', 0.35, 4, 0);
    drawStaticWave('rgba(96,165,250,1)',  0.22, 6, 1.2);
  };

  /* ── live wave animation ── */
  const drawLive = () => {
    const canvas  = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d')!;
    const W = canvas.width, H = canvas.height, cy = H / 2;
    ctx.clearRect(0, 0, W, H);

    const buf = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(buf);

    // compute RMS
    let rms = 0;
    for (const v of buf) rms += ((v / 128) - 1) ** 2;
    const amp = Math.sqrt(rms / buf.length);

    const drawWave = (
      color: string, glow: string,
      ampScale: number, freqMult: number,
      phaseOff: number, lineW: number, alpha: number
    ) => {
      ctx.save();
      ctx.shadowBlur   = 20;
      ctx.shadowColor  = glow;
      ctx.strokeStyle  = color;
      ctx.lineWidth    = lineW;
      ctx.globalAlpha  = alpha;
      ctx.beginPath();
      const maxAmp = Math.min(amp * 220 * ampScale, cy * 0.9);
      for (let i = 0; i <= W; i++) {
        const t = i / W;
        const envelope = Math.sin(t * Math.PI);               // fade at edges
        const y = cy + Math.sin(phaseRef.current * freqMult + phaseOff + t * Math.PI * 5)
                     * maxAmp * envelope;
        if (i === 0) ctx.moveTo(i, y); else ctx.lineTo(i, y);
      }
      ctx.stroke();
      ctx.restore();
    };

    // purple layer (Priya)
    drawWave('rgba(168,85,247,0.9)',  'rgba(168,85,247,0.5)', 1.0, 1.0,  0,    2.5, 0.85);
    drawWave('rgba(168,85,247,0.6)',  'rgba(168,85,247,0.2)', 0.6, 1.3,  0.8,  1.5, 0.5);

    // blue layer (Rahul) — offset in phase so they feel like different speakers
    drawWave('rgba(96,165,250,0.75)', 'rgba(96,165,250,0.4)', 0.85, 0.9, 2.0,  2.0, 0.7);
    drawWave('rgba(96,165,250,0.4)',  'rgba(96,165,250,0.15)',0.5,  1.1, 2.8,  1.2, 0.4);

    // glowing centre dot
    const pulse = 2 + amp * 14;
    ctx.save();
    ctx.shadowBlur  = 14 + pulse * 3;
    ctx.shadowColor = 'rgba(200,140,255,0.9)';
    ctx.fillStyle   = 'rgba(220,180,255,1)';
    ctx.beginPath();
    ctx.arc(W / 2, cy, pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    phaseRef.current += 0.06;
    animRef.current = requestAnimationFrame(drawLive);
  };

  /* ── controls ── */
  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setupAnalyser();
    if (audio.paused) {
      audioCtxRef.current?.resume();
      audio.play();
      setIsPlaying(true);
      drawLive();
    } else {
      audio.pause();
      setIsPlaying(false);
      cancelAnimationFrame(animRef.current);
      drawIdle();
    }
  };

  const fmt = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Speaker labels */}
      <div className="flex items-center justify-between mx-4 mt-4 px-1">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-purple-500 shadow-md shadow-purple-500/60" />
          <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Priya</span>
        </div>
        <span className="text-[9px] text-muted-foreground/40 uppercase tracking-widest font-medium">Podcast</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Rahul</span>
          <div className="w-2 h-2 rounded-full bg-blue-500 shadow-md shadow-blue-500/60" />
        </div>
      </div>

      {/* Canvas — transparent, centred waves */}
      <div className="mx-4 mt-2 rounded-xl overflow-hidden relative border border-white/[0.04]"
           style={{ height: 130, background: 'transparent' }}>
        <canvas ref={canvasRef} width={500} height={130} className="w-full h-full" />
      </div>

      {/* Play / Pause */}
      <div className="flex justify-center mt-4">
        <button onClick={togglePlay}
          className="w-14 h-14 bg-gradient-to-br from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-full flex items-center justify-center shadow-2xl shadow-purple-500/30 transition-all hover:scale-105 active:scale-95">
          {isPlaying ? <Pause className="w-6 h-6 text-white" /> : <Play className="w-6 h-6 text-white ml-0.5" />}
        </button>
      </div>

      {/* Progress */}
      <div className="mx-4 mt-3 flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground font-mono w-8">{fmt(currentTime)}</span>
        <input type="range" min={0} max={duration || 100} step={0.1} value={currentTime}
          onChange={e => { if (audioRef.current) audioRef.current.currentTime = Number(e.target.value); }}
          className="flex-1 h-1 cursor-pointer rounded-full" style={{ accentColor: '#a855f7' }} />
        <span className="text-[10px] text-muted-foreground font-mono w-8 text-right">{fmt(duration)}</span>
      </div>

      {/* Hidden audio */}
      <audio ref={audioRef} src={src}
        onTimeUpdate={()    => setCurrentTime(audioRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={()         => { setIsPlaying(false); cancelAnimationFrame(animRef.current); drawIdle(); }}
      />

      {/* Transcript */}
      {script && (
        <div className="mx-4 mt-5 mb-4 space-y-2">
          <h3 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Transcript</h3>
          <div className="p-3 rounded-xl border border-white/[0.04] text-[11px] leading-relaxed text-foreground/55 whitespace-pre-wrap max-h-44 overflow-y-auto">
            {script}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main PodcastPanel ─────────────────────────────────────────────────────────
interface PodcastPanelProps {
  pdfFiles: { name: string; url: string }[];
  onExit: () => void;
  selectedPdfPage?: number | null;
  initialSourceText?: string | null;
  initialPageNumber?: number | null;
}

export const PodcastPanel = ({ pdfFiles, onExit, selectedPdfPage, initialSourceText, initialPageNumber }: PodcastPanelProps) => {
  const [podcastAudio,  setPodcastAudio]  = useState<string | null>(null);
  const [podcastScript, setPodcastScript] = useState<string | null>(null);
  const [generating,    setGenerating]    = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [query,         setQuery]         = useState('');
  const [selectedPdf,   setSelectedPdf]   = useState<{ name: string; url: string } | null>(null);

  const generate = async (file: { name: string; url: string }, q?: string, sourceText?: string, pageNum?: number) => {
    setSelectedPdf(file);
    setGenerating(true);
    setError(null);
    setPodcastAudio(null);
    setPodcastScript(null);
    try {
      const result: any = await generatePodcastAction(file.url, q, sourceText, pageNum);
      if (result.success) {
        setPodcastAudio(result.audioBase64);
        setPodcastScript(result.script);
      } else {
        setError(result.error || 'Failed to generate podcast.');
      }
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setGenerating(false);
    }
  };

  // Auto-generate if initial params are provided
  useEffect(() => {
    if (pdfFiles.length > 0) {
      if (initialSourceText) {
        generate(pdfFiles[0], undefined, initialSourceText);
      } else if (initialPageNumber) {
        generate(pdfFiles[0], undefined, undefined, initialPageNumber);
      }
    }
  }, []); // Only on mount

  return (
    <div className="flex flex-col h-full bg-card/50 overflow-hidden font-sans">

      {/* Header */}
      <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between sticky top-0 bg-card/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-2">
          <button onClick={onExit} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-6 h-6 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
            <Headphones className="w-3.5 h-3.5 text-purple-500" />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Podcast</span>
        </div>
      </div>

      {/* PDF selector tabs */}
      {pdfFiles.length > 1 && !generating && (
        <div className="px-4 py-2 border-b border-border/20 flex gap-1.5 overflow-x-auto bg-card/30">
          {pdfFiles.map((file, i) => (
            <button key={i} onClick={() => generate(file)}
              className={cn(
                "flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold border transition-all",
                selectedPdf?.url === file.url
                  ? "bg-purple-500/20 border-purple-500/50 text-purple-400"
                  : "bg-muted/20 border-border/40 text-muted-foreground hover:border-purple-500/30"
              )}>
              <FileText className="w-3 h-3" />
              <span className="truncate max-w-[100px]">{file.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 overflow-hidden">
        {generating ? (
          <MicLoadingState />
        ) : error ? (
          <div className="p-6 m-4 rounded-2xl bg-red-500/5 border border-red-500/10 text-center space-y-3">
            <p className="text-red-400 text-sm font-medium">{error}</p>
            <button onClick={() => selectedPdf && generate(selectedPdf, query)}
              className="px-4 py-1.5 bg-red-500/10 text-red-400 rounded-full text-xs font-bold hover:bg-red-500/20 transition-all">
              Try Again
            </button>
          </div>
        ) : podcastAudio ? (
          <WaveformPlayer audioBase64={podcastAudio} script={podcastScript} />
        ) : (
          /* Idle / prompt state */
          <div className="flex flex-col items-center justify-center h-full space-y-6 py-12 px-6">
            <div className="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center border border-border/30">
              <Headphones className="w-8 h-8 text-muted-foreground/50" />
            </div>

            {/* If a page is selected, show page CTA */}
            {selectedPdfPage ? (
              <div className="w-full flex flex-col items-center gap-3">
                <div className="p-3 rounded-xl bg-purple-500/8 border border-purple-500/20 text-center">
                  <p className="text-xs font-bold text-foreground">Page {selectedPdfPage} is active</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Generate a podcast for this exact page</p>
                </div>
                <button
                  onClick={() => pdfFiles.length > 0 && generate(pdfFiles[0], undefined, undefined, selectedPdfPage)}
                  className="w-full py-3 bg-purple-500 text-white rounded-xl text-sm font-bold hover:bg-purple-600 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20">
                  <Headphones className="w-4 h-4" /> Generate Audio for Page {selectedPdfPage}
                </button>
              </div>
            ) : (
              <div className="text-center space-y-2">
                <p className="text-sm font-bold text-foreground">Interactive Audio Podcast</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Ask a question or select a page to generate a 2-speaker conversation.
                </p>
              </div>
            )}

            {/* Query form */}
            <form onSubmit={e => { e.preventDefault(); pdfFiles.length > 0 && generate(pdfFiles[0], query); }}
              className="w-full flex gap-2">
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Ask a question about the doc…"
                className="flex-1 bg-muted/20 border border-border/50 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-purple-500/50 text-foreground placeholder:text-muted-foreground"
              />
              <button type="submit"
                className="px-3 py-2 bg-purple-500 text-white font-bold rounded-lg text-xs hover:bg-purple-600 transition-colors shadow-md shadow-purple-500/20 whitespace-nowrap">
                Go
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
