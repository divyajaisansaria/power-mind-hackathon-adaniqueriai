"use client"

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Headphones,
  Sparkles,
  Link as LinkIcon,
  Search,
  FileText,
  ArrowLeft,
  Loader2,
  Printer,
  CheckCircle2,
  Brain,
  ScanText,
  Cpu,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { generateSummaryAction, generatePodcastAction, getPageContentAction } from '@/lib/actions';
import { Volume2 } from 'lucide-react';
import { PodcastPanel } from './PodcastPanel';

// Only keeping Summarize and Audio Overview
const studioItems = [
  { id: 'summary', label: 'Summarize', icon: FileText, color: 'text-purple-500' },
  { id: 'podcast', label: 'Audio Overview', icon: Headphones, color: 'text-purple-500' },
];

const LOADING_STEPS = [
  { icon: ScanText,     label: 'Reading document pages...' },
  { icon: Brain,        label: 'Extracting key insights...' },
  { icon: Cpu,          label: 'Synthesizing summary...' },
  { icon: CheckCircle2, label: 'Finalising report...' },
];

function SummaryLoadingState({ fileName }: { fileName: string }) {
  const [step, setStep] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setStep(s => Math.min(s + 1, LOADING_STEPS.length - 1)), 2200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full space-y-8 py-16 px-6">
      <div className="relative flex items-center justify-center">
        <div className="absolute w-20 h-20 bg-purple-500/20 rounded-full blur-2xl animate-pulse" />
        <div className="absolute w-14 h-14 bg-purple-500/30 rounded-full blur-xl animate-ping" style={{ animationDuration: '2s' }} />
        <div className="w-12 h-12 bg-purple-500/10 border border-purple-500/30 rounded-2xl flex items-center justify-center relative z-10">
          <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
        </div>
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-bold text-foreground">Generating Summary</p>
        <p className="text-[11px] text-purple-400 font-medium truncate max-w-[180px] mx-auto">{fileName}</p>
      </div>
      <div className="w-full space-y-2.5">
        {LOADING_STEPS.map((s, i) => {
          const Icon = s.icon;
          const done = i < step;
          const active = i === step;
          return (
            <div key={i} className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-500",
              done   && "bg-green-500/5 border-green-500/20 opacity-60",
              active && "bg-purple-500/10 border-purple-500/30",
              !done && !active && "border-border/20 opacity-30"
            )}>
              <div className={cn(
                "w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0",
                done   && "bg-green-500/20",
                active && "bg-purple-500/20",
                !done && !active && "bg-muted/20"
              )}>
                {done
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                  : <Icon className={cn("w-3.5 h-3.5", active ? "text-purple-400 animate-pulse" : "text-muted-foreground")} />
                }
              </div>
              <span className={cn(
                "text-[11px] font-medium",
                done   && "text-green-400",
                active && "text-purple-300",
                !done && !active && "text-muted-foreground"
              )}>{s.label}</span>
              {active && (
                <div className="ml-auto flex gap-0.5">
                  {[0,1,2].map(d => (
                    <div key={d} className="w-1 h-1 bg-purple-500 rounded-full animate-bounce"
                      style={{ animationDelay: `${d * 0.15}s` }} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface StudioPanelProps {
  sources?: any[];
  notebookId?: string;
  pdfFiles?: { name: string; url: string }[];
  onSummaryModeChange?: (active: boolean) => void;
  onSourceClick?: (source: any) => void;
  activePage?: number | null;
}

export const StudioPanel = ({ sources = [], notebookId, pdfFiles = [], onSummaryModeChange, onSourceClick, activePage }: StudioPanelProps) => {
  const [summaryMode, setSummaryMode] = useState(false);
  const [podcastMode, setPodcastMode] = useState(false);
  const [pendingPodcastParams, setPendingPodcastParams] = useState<{ sourceText?: string | null; pageNumber?: number | null }>({});

  const [summary, setSummary] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPdf, setSelectedPdf] = useState<{ name: string; url: string } | null>(null);
  const [selectedSourceIdx, setSelectedSourceIdx] = useState<number | null>(null);

  const enterPodcastMode = (params: { sourceText?: string | null; pageNumber?: number | null } = {}) => {
    setPendingPodcastParams(params);
    setPodcastMode(true);
    setSummaryMode(false);
    onSummaryModeChange?.(true);
  };

  const exitPodcastMode = () => {
    setPodcastMode(false);
    setPendingPodcastParams({});
    onSummaryModeChange?.(false);
  };

  const enterSummaryMode = () => {
    setSummaryMode(true);
    setPodcastMode(false);
    onSummaryModeChange?.(true);
    if (!summary && pdfFiles.length > 0) {
      handleGenerateSummary(pdfFiles[0]);
    }
  };

  const exitSummaryMode = () => {
    setSummaryMode(false);
    onSummaryModeChange?.(false);
  };



  const handleGenerateSummary = async (file: { name: string; url: string }) => {
    setSelectedPdf(file);
    setGenerating(true);
    setError(null);
    setSummary(null);
    try {
      const result: any = await generateSummaryAction(file.url);
      if (result.success) {
        setSummary(result.summary.overview);
      } else {
        setError(result.error || 'Failed to generate summary.');
      }
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setGenerating(false);
    }
  };

  // ── Summary View ──────────────────────────────────────────────────────────────
  if (summaryMode) {
    return (
      <div className="flex flex-col h-full bg-card/50 overflow-hidden font-sans">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between sticky top-0 bg-card/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-2">
            <button onClick={exitSummaryMode} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-6 h-6 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
              <FileText className="w-3.5 h-3.5 text-purple-500" />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">AI Summary</span>
          </div>
          {summary && (
            <button onClick={() => window.print()} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <Printer className="w-4 h-4 text-muted-foreground/60" />
            </button>
          )}
        </div>

        {/* PDF selector tabs */}
        {pdfFiles.length > 1 && !generating && (
          <div className="px-4 py-2 border-b border-border/20 flex gap-1.5 overflow-x-auto bg-card/30">
            {pdfFiles.map((file, i) => (
              <button key={i} onClick={() => handleGenerateSummary(file)}
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {generating ? (
            <SummaryLoadingState fileName={selectedPdf?.name || 'document'} />
          ) : error ? (
            <div className="p-6 m-4 rounded-2xl bg-red-500/5 border border-red-500/10 text-center space-y-3">
              <p className="text-red-400 text-sm font-medium">{error}</p>
              <button onClick={() => selectedPdf && handleGenerateSummary(selectedPdf)}
                className="px-4 py-1.5 bg-red-500/10 text-red-400 rounded-full text-xs font-bold hover:bg-red-500/20 transition-all">
                Try Again
              </button>
            </div>
          ) : summary ? (
            <div className="px-5 py-4">
              <div className="flex items-center gap-2 mb-5 pb-3 border-b border-border/20">
                <Sparkles className="w-4 h-4 text-purple-500" />
                <span className="text-[11px] font-black uppercase tracking-widest italic text-purple-400">Executive Summary</span>
              </div>
              <div className="text-base leading-relaxed prose prose-invert prose-sm max-w-none">
                <ReactMarkdown components={{
                  h1: ({ children }) => <h1 className="text-lg font-black text-foreground mb-4 mt-6 first:mt-0">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-base font-bold text-purple-400 mb-3 mt-5 first:mt-0 uppercase tracking-wide">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-sm font-bold text-foreground/90 mb-2 mt-4">{children}</h3>,
                  p: ({ children }) => <p className="text-[15px] text-foreground/80 mb-4 leading-relaxed">{children}</p>,
                  strong: ({ children }) => <strong className="font-bold text-foreground">{children}</strong>,
                  em: ({ children }) => <em className="italic text-foreground/70">{children}</em>,
                  ul: ({ children }) => <ul className="mb-4 space-y-2 pl-1">{children}</ul>,
                  ol: ({ children }) => <ol className="mb-4 space-y-2 pl-1 list-decimal list-inside">{children}</ol>,
                  li: ({ children }) => (
                    <li className="text-[15px] text-foreground/80 flex gap-2 items-start">
                      <span className="text-purple-500 mt-1 flex-shrink-0 font-bold">›</span>
                      <span>{children}</span>
                    </li>
                  ),
                  hr: () => <hr className="border-border/30 my-6" />,
                }}>
                  {summary}
                </ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-50 py-20 px-6">
              <FileText className="w-10 h-10 text-purple-500/50" />
              <p className="text-sm font-bold">No summary yet</p>
              {pdfFiles.length > 0 && (
                <button onClick={() => handleGenerateSummary(pdfFiles[0])}
                  className="px-4 py-2 bg-purple-500/10 text-purple-400 rounded-full text-xs font-bold hover:bg-purple-500/20 transition-all border border-purple-500/20">
                  Generate Summary
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Podcast Mode → delegate to PodcastPanel ─────────────────────────────────
  if (podcastMode) {
    return (
      <PodcastPanel
        pdfFiles={pdfFiles}
        selectedPdfPage={activePage}
        onExit={exitPodcastMode}
        initialSourceText={pendingPodcastParams.sourceText}
        initialPageNumber={pendingPodcastParams.pageNumber}
      />
    );
  }

  // ── Default Studio Grid ───────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-card/50 overflow-y-auto custom-scrollbar font-sans">
      <div className="p-4 border-b border-border/30 flex items-center justify-between sticky top-0 bg-card/80 backdrop-blur-md z-10">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Studio &amp; Sources</h2>
      </div>
      <div className="p-4 space-y-6">

        {/* Selected PDF page CTA */}
        {activePage != null && (
          <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 flex flex-col items-center text-center space-y-3 shadow-sm">
            <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center border border-purple-500/30">
              <FileText className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Page {activePage} Selected</p>
              <p className="text-xs text-muted-foreground mt-1">Generate a podcast for this page</p>
            </div>
            <button onClick={() => enterPodcastMode({ pageNumber: activePage })}
              className="w-full py-2.5 bg-purple-500 text-white rounded-xl text-sm font-bold hover:bg-purple-600 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20">
              <Headphones className="w-4 h-4" /> Generate Audio for Page {activePage}
            </button>
          </div>
        )}

        {/* Retrieved Sources */}
        {sources.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-primary font-bold text-[10px] uppercase tracking-wider mb-1">
              <Search className="w-3 h-3" /> Top Retrieved Sources
            </div>
            <div className="space-y-2">
              {sources.slice(0, 5).map((source, idx) => (
                <div key={idx} 
                     onClick={() => { onSourceClick?.(source); setSelectedSourceIdx(idx); }}
                     className={cn(
                       "p-3 rounded-xl border transition-all cursor-pointer",
                       selectedSourceIdx === idx
                         ? "bg-purple-500/5 border-purple-500/30"
                         : "bg-muted/20 border-border/50 hover:border-primary/30 group"
                     )}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-muted flex items-center justify-center text-[10px] font-bold">#{source.rank}</span>
                      <span className="text-[11px] font-bold text-foreground/80">{source.citation}</span>
                    </div>
                    <div className="text-[9px] font-medium text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded">Score: {source.rrf_score}</div>
                  </div>
                  <p className="text-[10px] text-muted-foreground line-clamp-3 leading-relaxed">
                    {source.content.substring(0, 150)}...
                  </p>

                  {selectedSourceIdx === idx && (
                    <div className="mt-3 pt-3 border-t border-purple-500/10 flex flex-col gap-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          enterPodcastMode({ sourceText: source.content });
                        }}
                        className="w-full py-2 bg-purple-500 text-white rounded-lg text-xs font-bold hover:bg-purple-600 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20"
                      >
                        <Headphones className="w-4 h-4" /> Generate Audio for this Source
                      </button>
                    </div>
                  )}

                  <div className="mt-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="text-[9px] font-bold text-primary flex items-center gap-1 hover:underline">
                      <LinkIcon className="w-3 h-3" /> View Source
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Localization alert removed per user request */}

        <div className="grid grid-cols-2 gap-3">
          {studioItems.map((item) => (
            <button key={item.id} id={`studio-item-${item.id}`}
              onClick={() => {
                if (item.id === 'summary') enterSummaryMode();
                if (item.id === 'podcast') enterPodcastMode();
              }}
              className={cn(
                "flex flex-col items-center justify-center p-4 rounded-2xl bg-card border border-border/50 hover:border-primary/50 transition-all space-y-2 group shadow-sm hover:shadow-md",
                item.id === 'summary' && "ring-1 ring-purple-500/30 hover:ring-purple-500/60",
                item.id === 'podcast' && "ring-1 ring-purple-500/30 hover:ring-purple-500/60"
              )}>
              <item.icon className={`w-5 h-5 ${item.color} group-hover:scale-110 transition-transform`} />
              <span className="text-[10px] font-semibold text-center leading-tight">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Empty state placeholder removed per user request */}
      </div>
    </div>
  );
};
