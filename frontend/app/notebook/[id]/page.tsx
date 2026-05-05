"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ResizableLayout } from '@/components/ResizableLayout'
import { SidebarSources } from '@/components/SidebarSources'
import { AdobePdfViewer } from '@/components/AdobePdfViewer'
import { ChatPanel } from '@/components/ChatPanel'
import { StudioPanel } from '@/components/StudioPanel'
import { Loader2, Edit2, Check, X as CloseIcon, ShieldAlert } from 'lucide-react'
import { ScanningLoader } from '@/components/ScanningLoader'
import { auth } from '@/lib/firebase'
import { useAuthStore } from '@/lib/authStore'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { getNotebookAction, updateNotebookTitleAction } from '@/lib/actions'

import { ThemeToggle } from '@/components/ThemeToggle';

export default function DocumentPage() {
  const params = useParams()
  const router = useRouter()
  const notebookId = params.id as string
  const { role, user, init } = useAuthStore()
  
  const [notebook, setNotebook] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const [activeSource, setActiveSource] = useState<{name: string, url: string, page?: number} | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [sources, setSources] = useState<any[]>([])
  const [summaryMode, setSummaryMode] = useState(false)
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false)
  const [isRightCollapsed, setIsRightCollapsed] = useState(false)
  const [sessions, setSessions] = useState<any[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const sessionRef = React.useRef<string | null>(null)
  const [navigationTarget, setNavigationTarget] = useState<{page: number, text?: string} | null>(null)
  const [currentPage, setCurrentPage] = useState<number | null>(null)

  useEffect(() => {
    if (notebook?.title) {
      document.title = `${notebook.title} | Adani QueryAI`
    } else {
      document.title = 'Adani QueryAI'
    }
  }, [notebook?.title])

  useEffect(() => {
    init()
  }, [])

  // Load notebook and sessions — use `user` from zustand store (not auth.currentUser)
  // to avoid race conditions where role is set but auth.currentUser is not yet populated
  useEffect(() => {
    async function loadNotebook() {
      if (!role || !user) return
      setLoading(true)
      try {
        const data = await getNotebookAction(notebookId, role)

        if (data) {
          setNotebook(data)
          // Load chat sessions for ANY logged-in user (not just owner/admin)
          const { getChatSessionsAction } = await import('@/lib/actions')
          const sess = await getChatSessionsAction(notebookId, user.uid)
          setSessions(sess)
          if (sess.length > 0) {
            setActiveSessionId(sess[0].id)
            sessionRef.current = sess[0].id
          }
        } else {
          setAccessDenied(true)
        }
      } catch (error) {
        console.error("Error loading notebook:", error)
      } finally {
        setLoading(false)
      }
    }
    loadNotebook()
  }, [notebookId, role, user, router])

  useEffect(() => {
    async function loadMessages() {
      if (activeSessionId) {
        const { getChatMessagesAction } = await import('@/lib/actions')
        const msgs = await getChatMessagesAction(activeSessionId)
        setMessages(msgs.map(m => ({ role: m.role, content: m.content })))
        
        // Restore sources from local storage
        const savedSources = localStorage.getItem(`sources_${activeSessionId}`);
        if (savedSources) {
          try {
            setSources(JSON.parse(savedSources));
          } catch (e) {
            setSources([]);
          }
        } else {
          setSources([]);
        }
      } else {
        setMessages([])
        setSources([]);
      }
    }
    loadMessages()
  }, [activeSessionId])

  // Save sources to local storage when they change
  useEffect(() => {
    if (activeSessionId && sources && sources.length > 0) {
      localStorage.setItem(`sources_${activeSessionId}`, JSON.stringify(sources));
    }
  }, [sources, activeSessionId])

  const handleRename = async (newTitle: string) => {
    if (!newTitle.trim() || role !== 'ADMIN') return
    try {
      const result = await updateNotebookTitleAction(notebookId, newTitle, role)
      if (result.success) {
        setNotebook({ ...notebook, title: newTitle })
      }
    } catch (error) {
      console.error("Rename error:", error)
    }
  }

  const handleSaveMessage = useCallback(async (msgRole: string, content: string, explicitSessionId?: string | null) => {
    let sessionId = explicitSessionId || sessionRef.current;
    const currentUser = user || auth.currentUser;
    
    if (!currentUser) {
      console.error("No authenticated user found, cannot save message");
      return sessionId;
    }
    
    const { createChatSessionAction, saveChatMessageAction, updateChatSessionTitleAction } = await import('@/lib/actions')
    
    // Create a new session if none exists
    if (!sessionId) {
      // Auto-generate title from the first user message (truncated)
      const autoTitle = msgRole === 'user' 
        ? content.slice(0, 50) + (content.length > 50 ? '...' : '')
        : "New Chat";
      
      const res = await createChatSessionAction(notebookId, currentUser.uid, autoTitle);
      if (res.success && res.session) {
        sessionId = res.session.id;
        sessionRef.current = sessionId; // 🔑 Sync Ref immediately
        setActiveSessionId(sessionId);
        setSessions(prev => [res.session, ...prev]);
      } else {
        console.error("Failed to create chat session");
        return sessionId;
      }
    }
    
    if (sessionId) {
      await saveChatMessageAction(sessionId, msgRole, content);
      
      // If this is the first user message and the session title is still generic, update it
      if (msgRole === 'user') {
        const currentSession = sessions.find(s => s.id === sessionId);
        if (currentSession && (currentSession.title === "New Chat" || currentSession.title.startsWith("Chat "))) {
          const newTitle = content.slice(0, 50) + (content.length > 50 ? '...' : '');
          // Update title in DB and locally
          try {
            if (typeof updateChatSessionTitleAction === 'function') {
              await updateChatSessionTitleAction(sessionId, newTitle);
            }
          } catch (e) {
            // Non-critical, ignore
          }
          setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title: newTitle } : s));
        }
      }
    }
    
    return sessionId;
  }, [activeSessionId, user, notebookId, sessions])

  const handleDeleteSession = async (sessionId: string) => {
    const { deleteChatSessionAction } = await import('@/lib/actions')
    const res = await deleteChatSessionAction(sessionId)
    if (res.success) {
      setSessions(prev => prev.filter(s => s.id !== sessionId))
      if (activeSessionId === sessionId) {
        setActiveSessionId(null)
        setMessages([])
      }
    }
  }

  const handleCitationClick = (citationOrId: string | any) => {
    let citationId = "";
    let content = "";
    let page = 1;

    if (typeof citationOrId === 'string') {
      citationId = citationOrId;
      // Find in sources
      const source = sources.find(s => s.citation === citationId);
      if (source) {
        content = source.content;
        page = parseInt(source.page, 10);
      } else {
        // Fallback: parse page from ID (e.g. p25:b3c5367c)
        const pageMatch = citationId.match(/^p(\d+):/);
        page = pageMatch ? parseInt(pageMatch[1], 10) : 1;
      }
    } else {
      // It's a source object (from StudioPanel)
      citationId = citationOrId.citation;
      content = citationOrId.content;
      page = parseInt(citationOrId.page, 10);
    }

    console.log("DocumentPage: Citation clicked:", citationId, "Page:", page);

    // Open the PDF and navigate
    if (notebook?.fileUrls?.[0]) {
      setActiveSource({
        name: notebook.fileUrls[0].split('/').pop()?.split('?')[0]?.replace(/%20/g, ' ') || 'Source',
        url: notebook.fileUrls[0],
        page: page
      });
      
      // Use the first 100 characters for text search highlighting
      // BUT first clean the content to remove metadata headers that aren't in the PDF
      let cleanContent = content || "";
      
      // The backend prepends metadata like: "Section: ... | Page: ... | Type: ... | Topic: ..."
      // We MUST strip this out, otherwise the PDF viewer searches for metadata and jumps to random pages!
      cleanContent = cleanContent.replace(/Section:.*?\|.*?Page:.*?\|.*?Type:.*?\|.*?Topic:.*?(?:\n|  |$)/i, '').trim();
      
      if (cleanContent.includes('\n')) {
        const lines = cleanContent.split('\n');
        // If the first line still looks like a synthetic header, skip it
        if (lines[0].includes('Section:') || lines[0].includes('Topic:')) {
            cleanContent = lines.slice(1).join('\n').trim();
        }
      }

      // Remove common formatting artifacts
      if (cleanContent.startsWith('Context: ')) {
        cleanContent = cleanContent.replace('Context: ', '').trim();
      }
      if (cleanContent.startsWith('Visuals from Page')) {
        const split = cleanContent.split(':');
        if (split.length > 1) cleanContent = split.slice(1).join(':').trim();
      }

      // Strip leading markdown table characters if any
      cleanContent = cleanContent.replace(/^[| ]+/, '');
      // Remove double spaces and line breaks within the snippet
      cleanContent = cleanContent.replace(/\s+/g, ' ');
      
      // Adobe PDF search is highly sensitive to line breaks and formatting.
      // We take a short, dense snippet (around 45 chars) to maximize match probability.
      let textToSearch = cleanContent.replace(/\s+/g, ' ').trim();
      
      // If the snippet starts with a non-alphanumeric character (like a bullet point), strip it
      textToSearch = textToSearch.replace(/^[^a-zA-Z0-9]+/, '');
      
      if (textToSearch.length > 45) {
        textToSearch = textToSearch.substring(0, 45);
      }
      
      console.log("DocumentPage: Searching for text:", textToSearch);
      
      setNavigationTarget({ 
        page: page, 
        text: textToSearch
      });
      
      setIsLeftCollapsed(false);
      setIsRightCollapsed(true);
    }
  }
  
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <ScanningLoader />
      </div>
    )
  }

  if (accessDenied) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-background space-y-6">
        <div className="p-4 rounded-full bg-red-500/10">
          <ShieldAlert className="w-12 h-12 text-red-500" />
        </div>
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground">You don't have permission to view this document.</p>
        </div>
        <button 
          onClick={() => router.push('/dashboard')}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-xl font-bold"
        >
          Go back to Dashboard
        </button>
      </div>
    )
  }

  const title = notebook?.title || "Untitled document"

  return (
    <ProtectedRoute>
      <div className="flex flex-col h-screen bg-background">
        {/* Navbar */}
        <nav className="flex items-center justify-between px-6 py-3 border-b border-border/30">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push('/dashboard')}
              className="p-2 rounded-full hover:bg-muted transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center overflow-hidden p-1 shadow-sm">
                <img 
                  src="https://res.cloudinary.com/dktgnnqia/image/upload/v1777817754/Adani_2012_logo-removebg-preview_n7pgul.png" 
                  alt="Adani Logo" 
                  className="w-full h-full object-contain"
                />
              </div>
            </button>
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 group">
                  <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">Adani QueryAI</h1>
                </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </nav>

        {/* Main Resizable Content */}
        <ResizableLayout 
          hasSources={notebook?.fileUrls && notebook.fileUrls.length > 0}
          isLeftCollapsed={isLeftCollapsed}
          setIsLeftCollapsed={setIsLeftCollapsed}
          isRightCollapsed={isRightCollapsed}
          setIsRightCollapsed={setIsRightCollapsed}
          defaultLeftSize={activeSource ? 45 : 20}
          leftPanel={
            activeSource ? (
              <AdobePdfViewer 
                url={activeSource.url} 
                fileName={activeSource.name}
                initialPage={activeSource.page}
                navigationTarget={navigationTarget}
                onPageChange={setCurrentPage}
                onClose={() => {
                  setActiveSource(null)
                  setIsRightCollapsed(false)
                  setNavigationTarget(null)
                  setCurrentPage(null)
                }}
              />
            ) : (
              <SidebarSources 
                files={notebook?.fileUrls ? notebook.fileUrls.map((url: string, i: number) => ({ 
                  name: url.split('/').pop()?.split('?')[0]?.replace(/%20/g, ' ') || `Source ${i+1}`, 
                  url 
                })) : []} 
                onSelectSource={(file) => {
                  setActiveSource(file)
                  setIsLeftCollapsed(false)
                  setIsRightCollapsed(true)
                }}
                onSummarizePdf={(file) => {
                  setSummaryMode(true)
                  setIsRightCollapsed(false)
                }}
              />
            )
          }
          centerPanel={
            <ChatPanel 
              documentTitle={title} 
              sourceCount={notebook?.fileUrls?.length || 0}
              messages={messages}
              setMessages={setMessages}
              setSources={setSources}
              onRename={handleRename}
              isOwner={role === 'ADMIN'}
              onCitationClick={handleCitationClick}
              sessions={sessions}
              activeSessionId={activeSessionId}
              onSelectSession={(id) => {
                setActiveSessionId(id);
                sessionRef.current = id;
              }}
              onNewSession={() => {
                setActiveSessionId(null);
                sessionRef.current = null;
              }}
              onSaveMessage={handleSaveMessage}
              onDeleteSession={handleDeleteSession}
            />
          }
          summaryMode={summaryMode}
          rightPanel={
            <StudioPanel
              sources={sources}
              onSourceClick={handleCitationClick}
              pdfFiles={notebook?.fileUrls ? notebook.fileUrls.map((url: string, i: number) => ({
                name: url.split('/').pop()?.split('?')[0]?.replace(/%20/g, ' ') || `Source ${i+1}`,
                url
              })) : []}
              onSummaryModeChange={setSummaryMode}
              activePage={currentPage}
            />
          }
        />
      </div>
    </ProtectedRoute>
  )
}
