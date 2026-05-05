"use client"

import React from 'react'
import { MoreVertical, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DocumentCardProps {
  title: string
  date: string
  sourceCount: number
  onClick?: () => void
  isNew?: boolean
}

export const DocumentCard = ({ title, date, sourceCount, onClick, isNew }: DocumentCardProps) => {
  if (isNew) {
    return (
      <div 
        onClick={onClick}
        className="group relative flex flex-col items-center justify-center h-48 rounded-2xl border-2 border-dashed border-muted-foreground/20 bg-muted/5 hover:bg-muted/10 transition-all cursor-pointer"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/20 group-hover:bg-muted/30 transition-colors">
          <span className="text-2xl text-muted-foreground">+</span>
        </div>
        <span className="mt-4 text-sm font-medium text-muted-foreground">Create new notebook</span>
      </div>
    )
  }

  return (
    <div 
      onClick={onClick}
      className="group relative flex flex-col h-48 rounded-2xl bg-card border border-border/50 hover:border-border p-5 transition-all cursor-pointer shadow-sm hover:shadow-md"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 rounded-lg bg-muted/30">
          <FileText className="w-6 h-6 text-foreground/70" />
        </div>
        <button className="p-1 rounded-full hover:bg-muted/50 transition-colors opacity-0 group-hover:opacity-100">
          <MoreVertical className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
      
      <div className="mt-auto">
        <h3 className="text-lg font-semibold text-foreground truncate">{title}</h3>
        <p className="text-xs text-muted-foreground mt-1">
          {date} • {sourceCount} {sourceCount === 1 ? 'source' : 'sources'}
        </p>
      </div>
    </div>
  )
}
