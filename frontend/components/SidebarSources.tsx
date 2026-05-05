"use client"

import React from 'react'
import { FileText, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SidebarSourcesProps {
  files?: { name: string, url: string }[]
  onSelectSource?: (file: { name: string, url: string }) => void
  onSummarizePdf?: (file: { name: string, url: string }) => void
}

export const SidebarSources = ({ files = [], onSelectSource, onSummarizePdf }: SidebarSourcesProps) => {
  return (
    <div className="flex flex-col h-full p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold tracking-tight">Sources</h2>
      </div>

      {files.length > 0 ? (
        <div className="space-y-2 overflow-y-auto pr-1 custom-scrollbar">
          {files.map((file, index) => (
            <div 
              key={index} 
              className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50 hover:border-primary/30 transition-all cursor-pointer group relative"
            >
              <div 
                onClick={() => onSelectSource?.(file)}
                className="flex items-center gap-3 flex-1 min-w-0"
              >
                <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <FileText className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">PDF</p>
                </div>
              </div>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSummarizePdf?.(file);
                }}
                className="p-2 rounded-lg bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition-all opacity-0 group-hover:opacity-100"
                title="Summarize PDF"
              >
                <Sparkles className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 px-4 opacity-60">
          <div className="p-4 rounded-full bg-muted/30">
            <FileText className="w-8 h-8 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="font-medium text-foreground">No sources found</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Documents shared with your role will appear here.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
