"use client"

import React, { useEffect, useState, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, X } from 'lucide-react';

// Set worker path dynamically to match library version
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface PdfJsViewerProps {
  url: string;
  onClose: () => void;
}

export const PdfJsViewer = ({ url, onClose }: PdfJsViewerProps) => {
  const [pdf, setPdf] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const loadPdf = async () => {
      setLoading(true);
      setError(null);
      try {
        console.log("Loading PDF from:", url);
        const loadingTask = pdfjsLib.getDocument({
          url,
          withCredentials: false // Change to true if needed for specific auth
        });
        const loadedPdf = await loadingTask.promise;
        setPdf(loadedPdf);
        setNumPages(loadedPdf.numPages);
        setLoading(false);
      } catch (err: any) {
        console.error("Error loading PDF:", err);
        setError(err.message || "Failed to load PDF document.");
        setLoading(false);
      }
    };
    loadPdf();
  }, [url]);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    let maxVisibleHeight = 0;
    let mostVisiblePage = 1;

    pageRefs.current.forEach((ref, index) => {
      if (!ref) return;
      const rect = ref.getBoundingClientRect();
      const visibleTop = Math.max(rect.top, containerRect.top);
      const visibleBottom = Math.min(rect.bottom, containerRect.bottom);
      const visibleHeight = Math.max(0, visibleBottom - visibleTop);

      if (visibleHeight > maxVisibleHeight) {
        maxVisibleHeight = visibleHeight;
        mostVisiblePage = index + 1;
      }
    });

    if (mostVisiblePage !== currentPage) {
      setCurrentPage(mostVisiblePage);
    }
  }, [currentPage]);

  const scrollToPage = (pageNum: number) => {
    const pageElement = pageRefs.current[pageNum - 1];
    if (pageElement && containerRef.current) {
      pageElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] rounded-2xl overflow-hidden border border-border/30 shadow-2xl relative">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 bg-[#252525] border-b border-border/30 z-10 shadow-md">
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-[#333] rounded-lg p-1">
            <button 
              onClick={() => scrollToPage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1 || loading}
              className="p-1 hover:bg-[#444] rounded disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-medium tabular-nums">
              {currentPage} / {numPages || 0}
            </span>
            <button 
              onClick={() => scrollToPage(Math.min(numPages, currentPage + 1))}
              disabled={currentPage >= numPages || loading}
              className="p-1 hover:bg-[#444] rounded disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center bg-[#333] rounded-lg p-1">
            <button 
              onClick={() => setScale(prev => Math.max(0.5, prev - 0.2))}
              className="p-1 hover:bg-[#444] rounded"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-medium w-12 text-center">
              {Math.round(scale * 100)}%
            </span>
            <button 
              onClick={() => setScale(prev => Math.min(3, prev + 0.2))}
              className="p-1 hover:bg-[#444] rounded"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        </div>

        <button 
          onClick={onClose}
          className="text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-colors px-3 py-2 bg-primary/10 rounded-lg flex items-center gap-2"
        >
          <X className="w-3 h-3" /> Close
        </button>
      </div>

      {/* Page Container */}
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-8 space-y-8 scroll-smooth flex flex-col items-center bg-[#1a1a1a]"
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium animate-pulse">Loading Document...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-4">
            <div className="p-4 rounded-full bg-red-500/10 text-red-500">
              <X className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <p className="font-bold text-lg">Failed to load PDF</p>
              <p className="text-sm text-muted-foreground max-w-xs">{error}</p>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-bold"
            >
              Try Again
            </button>
          </div>
        ) : (
          Array.from({ length: numPages }).map((_, i) => (
            <PdfPage 
              key={`${url}-${i + 1}-${scale}`}
              pageNumber={i + 1}
              pdf={pdf!}
              scale={scale}
              ref={(el) => { pageRefs.current[i] = el; }}
            />
          ))
        )}
      </div>
    </div>
  );
};

interface PdfPageProps {
  pageNumber: number;
  pdf: any;
  scale: number;
}

const PdfPage = React.forwardRef<HTMLDivElement, PdfPageProps>(({ pageNumber, pdf, scale }, forwardedRef) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const internalRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [rendered, setRendered] = useState(false);

  // Sync internal ref with forwarded ref
  useEffect(() => {
    if (!forwardedRef) return;
    if (typeof forwardedRef === 'function') {
      forwardedRef(internalRef.current);
    } else {
      (forwardedRef as any).current = internalRef.current;
    }
  }, [forwardedRef]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect(); // Once visible, we stay visible
        }
      },
      { threshold: 0.1, rootMargin: '400px' }
    );

    if (internalRef.current) {
      observer.observe(internalRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const render = async () => {
      if (!isVisible || !pdf || !canvasRef.current || !textLayerRef.current || rendered) return;

      try {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale });
        
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise;

        // Text Layer
        const textContent = await page.getTextContent();
        textLayerRef.current.innerHTML = '';
        textLayerRef.current.style.width = `${viewport.width}px`;
        textLayerRef.current.style.height = `${viewport.height}px`;

        await pdfjsLib.renderTextLayer({
          textContent,
          container: textLayerRef.current,
          viewport: viewport,
        }).promise;

        setRendered(true);
      } catch (err) {
        console.error("Render error for page " + pageNumber + ":", err);
      }
    };
    render();
  }, [isVisible, pdf, pageNumber, scale, rendered]);

  return (
    <div 
      ref={internalRef}
      className="relative shadow-2xl bg-white transition-opacity duration-500"
      style={{ 
        width: 'fit-content',
        minHeight: '400px', // Larger placeholder for observer
        opacity: rendered ? 1 : 0.4
      }}
    >
      <canvas ref={canvasRef} />
      <div 
        ref={textLayerRef} 
        className="pdfjs-text-layer absolute top-0 left-0 text-transparent pointer-events-auto select-text overflow-hidden"
      />
    </div>
  );
});

PdfPage.displayName = 'PdfPage';
