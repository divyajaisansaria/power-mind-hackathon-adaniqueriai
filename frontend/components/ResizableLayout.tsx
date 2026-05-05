"use client"

import React, { useEffect } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react'

interface ResizableLayoutProps {
  leftPanel: React.ReactNode
  centerPanel: React.ReactNode
  rightPanel: React.ReactNode
  hasSources?: boolean
  isLeftCollapsed: boolean
  setIsLeftCollapsed: (v: boolean) => void
  isRightCollapsed: boolean
  setIsRightCollapsed: (v: boolean) => void
  defaultLeftSize?: number
  defaultRightSize?: number
  summaryMode?: boolean
}

export const ResizableLayout = ({ 
  leftPanel, 
  centerPanel, 
  rightPanel, 
  hasSources,
  isLeftCollapsed,
  setIsLeftCollapsed,
  isRightCollapsed,
  setIsRightCollapsed,
  defaultLeftSize = 20,
  defaultRightSize = 20,
  summaryMode = false
}: ResizableLayoutProps) => {

  // Auto-collapse left panel when summary mode activates
  useEffect(() => {
    if (summaryMode) {
      setIsLeftCollapsed(true)
    }
  }, [summaryMode, setIsLeftCollapsed])

  return (
    <div className="h-[calc(100vh-64px)] w-full bg-background overflow-hidden p-4 pt-2">
      <PanelGroup direction="horizontal" className="h-full gap-2">
        {/* Left Panel - Sources */}
        {!isLeftCollapsed ? (
          <>
            <Panel defaultSize={defaultLeftSize} minSize={15} maxSize={45} className="bg-card/50 rounded-2xl border border-border/50 relative group">
              <div className="h-full w-full overflow-hidden">
                {leftPanel}
              </div>
              <button 
                onClick={() => setIsLeftCollapsed(true)}
                className="absolute top-3.5 right-12 p-1.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors z-20"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </Panel>
            <PanelResizeHandle className="w-1 bg-transparent hover:bg-primary/20 transition-colors rounded-full cursor-col-resize mx-0.5" />
          </>
        ) : (
          <div className="w-12 h-full flex flex-col items-center pt-4 bg-card/50 rounded-2xl border border-border/50">
            <button 
              onClick={() => setIsLeftCollapsed(false)}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8">
              {hasSources && (
                <div className="p-2 rounded-lg bg-primary/10 mb-auto">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
              )}
              <div className="[writing-mode:vertical-lr] rotate-180 text-[10px] font-bold text-muted-foreground tracking-[0.2em] uppercase">
                Sources
              </div>
            </div>
          </div>
        )}

        {/* Center Panel - Chat */}
        <Panel 
          defaultSize={summaryMode ? 50 : 60} 
          minSize={30} 
          className="bg-card/50 rounded-2xl border border-border/50"
        >
          <div className="h-full w-full overflow-hidden">
            {centerPanel}
          </div>
        </Panel>

        {/* Right Panel - Studio */}
        {!isRightCollapsed ? (
          <>
            <PanelResizeHandle className="w-1 bg-transparent hover:bg-primary/20 transition-colors rounded-full cursor-col-resize mx-0.5" />
            <Panel 
              defaultSize={summaryMode ? 50 : defaultRightSize} 
              minSize={15} 
              maxSize={summaryMode ? 60 : 30} 
              className="bg-card/50 rounded-2xl border border-border/50 relative"
            >
              <div className="h-full w-full overflow-hidden">
                {rightPanel}
              </div>
              <button 
                onClick={() => setIsRightCollapsed(true)}
                className="absolute top-4 right-4 p-1.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors z-10"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </Panel>
          </>
        ) : (
          <div className="w-12 h-full flex flex-col items-center pt-4 bg-card/50 rounded-2xl border border-border/50">
            <button 
              onClick={() => setIsRightCollapsed(false)}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="mt-8 [writing-mode:vertical-lr] text-xs font-semibold text-muted-foreground tracking-widest uppercase">
              Studio
            </div>
          </div>
        )}
      </PanelGroup>
    </div>
  )
}
