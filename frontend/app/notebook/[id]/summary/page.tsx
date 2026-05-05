"use client"

import React, { useState, useEffect, Suspense } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Loader2, Sparkles, FileText, Download, Share2, Printer } from 'lucide-react'
import { useAuthStore } from '@/lib/authStore'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { getNotebookAction, generateSummaryAction } from '@/lib/actions'

function SummaryContent() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const notebookId = params.id as string
  const { role, init } = useAuthStore()
  
  const pdfUrl = searchParams.get('pdfUrl')
  const pdfName = searchParams.get('pdfName') || 'Document'

  const [notebook, setNotebook] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    init()
  }, [])

  useEffect(() => {
    async function loadData() {
      if (!role) return
      setLoading(true)
      try {
        const data = await getNotebookAction(notebookId, role)
        if (data) {
          setNotebook(data)
          // Use query param URL if given, otherwise fall back to first file
          const targetUrl = pdfUrl || (data.fileUrls && data.fileUrls.length > 0 ? data.fileUrls[0] : null)
          if (targetUrl) {
            handleGenerateSummary(targetUrl)
          }
        }
      } catch (error) {
        console.error("Error loading notebook:", error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [notebookId, role, pdfUrl])

  const handleGenerateSummary = async (url: string) => {
    setGenerating(true)
    setError(null)
    try {
      const result: any = await generateSummaryAction(url)
      if (result.success) {
        setSummary(result.summary.overview)
      } else {
        setError(result.error || "Failed to generate summary.")
      }
    } catch (err) {
      setError("An unexpected error occurred.")
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0b0d0e]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  const displayName = pdfName || notebook?.title || "Document Summary"

  return (
    <ProtectedRoute>
      <div className="flex flex-col min-h-screen bg-[#0b0d0e] text-foreground">
        {/* Navbar */}
        <nav className="flex items-center justify-between px-8 py-4 border-b border-border/30 bg-[#0b0d0e]/80 backdrop-blur-xl sticky top-0 z-50">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => router.back()}
              className="p-2 rounded-xl hover:bg-muted transition-all group"
            >
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            </button>
            <div className="h-8 w-px bg-border/30" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shadow-lg shadow-amber-500/5">
                <FileText className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight truncate max-w-xs">{displayName}</h1>
                <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-medium">AI Intelligence Report</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border/50 hover:bg-muted transition-all text-sm font-semibold">
              <Download className="w-4 h-4" />
              Export
            </button>
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-all text-sm font-bold shadow-lg shadow-primary/20">
              <Share2 className="w-4 h-4" />
              Share Report
            </button>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 max-w-4xl mx-auto w-full px-8 py-12">
          <div className="space-y-12">
            {generating ? (
              <div className="flex flex-col items-center justify-center py-40 space-y-6">
                <div className="relative">
                  <div className="absolute -inset-4 bg-amber-500/20 blur-2xl rounded-full animate-pulse" />
                  <Loader2 className="w-12 h-12 animate-spin text-amber-500 relative" />
                </div>
                <div className="text-center space-y-2">
                  <h2 className="text-xl font-bold">Synthesizing Document...</h2>
                  <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                    Our AI is analyzing <span className="text-amber-400 font-semibold">{displayName}</span> and creating a comprehensive executive summary.
                  </p>
                </div>
              </div>
            ) : error ? (
              <div className="p-8 rounded-3xl bg-red-500/5 border border-red-500/10 text-center space-y-4">
                <p className="text-red-400 font-medium">{error}</p>
                <button 
                  onClick={() => { const url = pdfUrl || notebook?.fileUrls?.[0]; if (url) handleGenerateSummary(url); }}
                  className="px-6 py-2 bg-red-500/10 text-red-500 rounded-full text-sm font-bold hover:bg-red-500/20 transition-all"
                >
                  Try Again
                </button>
              </div>
            ) : summary ? (
              <div className="bg-card/30 rounded-[2.5rem] border border-border/50 p-10 md:p-16 shadow-2xl backdrop-blur-sm relative overflow-hidden group">
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 blur-[100px] -mr-32 -mt-32 rounded-full" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/5 blur-[100px] -ml-32 -mb-32 rounded-full" />
                
                <div className="relative space-y-10">
                  <div className="flex items-center justify-between pb-8 border-b border-border/20">
                    <div className="flex items-center gap-4">
                      <Sparkles className="w-6 h-6 text-amber-500" />
                      <h2 className="text-2xl font-black uppercase tracking-tight italic">Executive Summary</h2>
                    </div>
                    <Printer className="w-5 h-5 text-muted-foreground/40 hover:text-foreground transition-colors cursor-pointer" onClick={() => window.print()} />
                  </div>

                  <div className="prose prose-invert prose-lg max-w-none prose-headings:font-black prose-headings:tracking-tight prose-p:text-foreground/80 prose-p:leading-relaxed">
                    <div className="whitespace-pre-wrap font-medium">
                      {summary}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-20">
                <p className="text-muted-foreground">No summary available.</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  )
}

export default function SummaryPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-[#0b0d0e]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <SummaryContent />
    </Suspense>
  )
}
