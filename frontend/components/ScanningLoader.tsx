"use client"

import React from 'react'
import { motion } from 'framer-motion'
import { FileText, Search } from 'lucide-react'

export const ScanningLoader = () => {
  return (
    <div className="flex flex-col items-center justify-center space-y-8 p-12">
      <div className="relative w-32 h-40">
        {/* The PDF Document */}
        <motion.div 
          className="absolute inset-0 bg-card border-2 border-border/50 rounded-2xl flex flex-col p-4 space-y-3 shadow-xl overflow-hidden"
          initial={{ opacity: 0.5, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          {/* Skeleton lines for document content */}
          <div className="w-1/2 h-2 bg-muted rounded-full" />
          <div className="w-full h-2 bg-muted rounded-full" />
          <div className="w-full h-2 bg-muted rounded-full opacity-60" />
          <div className="w-3/4 h-2 bg-muted rounded-full" />
          <div className="w-full h-2 bg-muted rounded-full opacity-40" />
          <div className="w-full h-2 bg-muted rounded-full" />
          
          <div className="mt-auto flex justify-between items-center">
             <FileText className="w-6 h-6 text-primary/40" />
             <div className="w-8 h-8 rounded-lg bg-primary/5" />
          </div>

          {/* Scanning Line */}
          <motion.div 
            className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent z-10 shadow-[0_0_15px_rgba(123,97,255,0.8)]"
            animate={{ 
              top: ["0%", "100%", "0%"]
            }}
            transition={{ 
              duration: 2.5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        </motion.div>

        {/* Magnifying Glass */}
        <motion.div 
          className="absolute -right-4 -bottom-4 z-20 text-primary drop-shadow-2xl"
          animate={{ 
            x: [-10, 10, -10],
            y: [-10, 10, -10],
            rotate: [0, 10, 0]
          }}
          transition={{ 
            duration: 3,
            repeat: Infinity,
            ease: "linear"
          }}
        >
          <div className="relative">
            <Search className="w-16 h-16" strokeWidth={1.5} />
            <motion.div 
              className="absolute top-2 left-2 w-10 h-10 rounded-full bg-primary/10 blur-sm"
              animate={{ opacity: [0.2, 0.5, 0.2] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          </div>
        </motion.div>
      </div>

      <div className="text-center space-y-2">
        <h3 className="text-xl font-bold tracking-tight text-foreground">Analyzing Document</h3>
        <p className="text-sm text-muted-foreground animate-pulse font-medium">
          Extracting insights using Adani QueryAI...
        </p>
      </div>
    </div>
  )
}
