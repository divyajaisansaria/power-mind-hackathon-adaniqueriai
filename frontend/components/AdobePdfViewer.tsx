"use client"

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface AdobePdfViewerProps {
  url: string;
  fileName: string;
  initialPage?: number;
  navigationTarget?: { page: number; text?: string } | null;
  onClose: () => void;
  onViewerReady?: (ready: boolean) => void;
  onPageChange?: (page: number) => void;
}

declare global {
  interface Window {
    AdobeDC: any;
  }
}

export const AdobePdfViewer = ({ url, fileName, initialPage, navigationTarget, onClose, onViewerReady, onPageChange }: AdobePdfViewerProps) => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const adobeDCView = useRef<any>(null);
  const viewerInstance = useRef<any>(null);
  const apisPromiseRef = useRef<Promise<any> | null>(null);

  useEffect(() => {
    console.log("AdobePdfViewer: Initializing with URL:", url);

    // Check if script already exists
    if (!document.getElementById('adobe-sdk')) {
      console.log("AdobePdfViewer: Loading Adobe SDK script...");
      const script = document.createElement('script');
      script.id = 'adobe-sdk';
      script.src = 'https://acrobatservices.adobe.com/view-sdk/viewer.js';
      script.async = true;
      document.body.appendChild(script);
    }

    const handleSdkReady = () => {
      console.log("AdobePdfViewer: SDK Ready Event received");
      initializeViewer();
    };

    document.addEventListener('adobe_dc_view_sdk.ready', handleSdkReady);

    // If already loaded
    if (window.AdobeDC) {
      console.log("AdobePdfViewer: SDK already available in window");
      initializeViewer();
    }

    return () => {
      document.removeEventListener('adobe_dc_view_sdk.ready', handleSdkReady);
      hardCleanup();
    };
  }, [url]);

  const hardCleanup = () => {
    console.log("AdobePdfViewer: Hard cleanup");
    adobeDCView.current = null;
    viewerInstance.current = null;
    apisPromiseRef.current = null;
    if (viewerRef.current) {
      viewerRef.current.innerHTML = "";
    }
  };

  useEffect(() => {
    if (initialPage && viewerInstance.current) {
      viewerInstance.current.getAPIs().then((apis: any) => {
        apis.gotoLocation(initialPage);
      }).catch(console.error);
    }
  }, [initialPage]);

  // Navigation Logic for citations
  useEffect(() => {
    if (!navigationTarget || !apisPromiseRef.current) return;
    
    const targetPage = Math.max(1, Math.floor(Number(navigationTarget.page)));
    
    console.log("AdobePdfViewer: Navigating to", targetPage, navigationTarget.text ? "with text search" : "");
    
    apisPromiseRef.current.then(async (apis: any) => {
      // 1. Move to the page
      await apis.gotoLocation(targetPage);
      
      // 2. If there is specific text, highlight it
      if (navigationTarget.text) {
        console.log("AdobePdfViewer: Initiating robust search for:", navigationTarget.text);
        
        setTimeout(async () => {
          try {
            const runSearch = async (query: string) => {
              if (!query || query.length < 5) return 0;
              console.log("AdobePdfViewer: Searching for fragment:", query);
              return await apis.search(query, { matchCase: false, wholeWord: false });
            };

            // Pass 1: Try the cleaned snippet as provided
            let matches = await runSearch(navigationTarget.text);
            
            // Pass 2: Try an ultra-short version if no match (to avoid cross-line/hyphenation issues)
            if (matches === 0 && navigationTarget.text.length > 25) {
              matches = await runSearch(navigationTarget.text.substring(0, 25));
            }
            
            // Pass 3: Try cleaning punctuation entirely
            if (matches === 0) {
              const ultraClean = navigationTarget.text
                .replace(/[^\w\s]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
              matches = await runSearch(ultraClean);
            }

            // Pass 4: Try a fragment from the middle if the text is long enough
            if (matches === 0 && navigationTarget.text.length > 30) {
              const middleFragment = navigationTarget.text.substring(15, 35);
              matches = await runSearch(middleFragment);
            }

            console.log("AdobePdfViewer: Search concluded. Total matches found:", matches);
            
            // CRITICAL FIX: Adobe's search automatically jumps to the first match in the entire document.
            // If it failed to match on the current page and found a random match elsewhere (e.g. page 38),
            // it will forcibly jump the user there. We must instantly force the viewer back to the intended page.
            if (navigationTarget.page) {
              apis.gotoLocation(navigationTarget.page);
            }
          } catch (err) {
            console.warn("AdobePdfViewer: Highlighting process failed:", err);
          }
        }, 1200); // 1.2s delay to ensure full render
      }
    }).catch(err => {
      console.error("AdobePdfViewer: API navigation failed:", err);
    });
  }, [navigationTarget]);

  const initializeViewer = () => {
    const clientId = process.env.NEXT_PUBLIC_ADOBE_CLIENT_ID;
    console.log("AdobePdfViewer: Using Client ID:", clientId);

    if (window.AdobeDC && viewerRef.current && clientId) {
      try {
        console.log("AdobePdfViewer: Creating DC View instance...");
        adobeDCView.current = new window.AdobeDC.View({
          clientId: clientId,
          divId: 'adobe-pdf-view',
        });

        console.log("AdobePdfViewer: Previewing file:", fileName);
        adobeDCView.current.previewFile({
          content: { location: { url } },
          metaData: { fileName }
        }, {
          embedMode: "SIZED_CONTAINER",
          showAnnotationTools: true,
          showLeftHandPanel: false,
          showDownloadPDF: true,
          showPrintPDF: true,
          showPageControls: true,
          dockPageControls: true,
          enableSearchAPIs: true, // 🔑 CRITICAL: Enable search APIs for highlighting
          defaultViewMode: "FIT_WIDTH",
        }).then((viewer: any) => {
          console.log("AdobePdfViewer: File preview success!");
          viewerInstance.current = viewer;
          apisPromiseRef.current = viewer.getAPIs();
          
          if (initialPage) {
            apisPromiseRef.current.then((apis: any) => apis.gotoLocation(initialPage));
            onPageChange?.(initialPage);
          } else {
            onPageChange?.(1);
          }


          // 🔑 Register for page change events on the VIEW instance
          adobeDCView.current.registerCallback(
            window.AdobeDC.View.Enum.CallbackType.EVENT_LISTENER,
            (event: any) => {
              if (event.type === "PAGE_VIEW") {
                const pageNum = event.data.pageNumber;
                console.log("AdobePdfViewer: Detected Page Change ->", pageNum);
                onPageChange?.(pageNum);
              }
            },
            { 
              enablePageViews: true, 
              enablePDFAnalytics: true 
            }
          );
          
        }).catch((error: any) => {
          console.error("AdobePdfViewer: File preview failed:", error);
        });
      } catch (err) {
        console.error("AdobePdfViewer: Initialization exception:", err);
      }
    } else {
      console.warn("AdobePdfViewer: Missing requirements for init:", {
        hasSDK: !!window.AdobeDC,
        hasRef: !!viewerRef.current,
        hasClientId: !!clientId
      });
    }
  };

  return (
    <div className="flex flex-col h-full bg-card rounded-2xl overflow-hidden border border-border/30 shadow-2xl">
      <div className="flex items-center justify-between p-3 bg-muted/50 border-b border-border/30">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground truncate max-w-[150px]">
          {fileName}
        </span>
        <button
          onClick={onClose}
          className="p-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-all"
          title="Close viewer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div id="adobe-pdf-view" ref={viewerRef} className="flex-1 w-full bg-white" />
    </div>
  );
};
