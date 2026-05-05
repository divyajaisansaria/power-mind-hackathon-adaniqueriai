"use client"

import React, { useState, useRef, useEffect } from 'react'
import { Send, Sparkles, Loader2, User as UserIcon, Mic, MicOff, Volume2, VolumeX, Bot, Edit2, Check, X as CloseIcon, MoreHorizontal, Plus, MessageSquare, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export const ChatPanel = ({ 
  documentTitle = "Untitled document",
  sourceCount = 0,
  messages,
  setMessages,
  setSources,
  onRename,
  isOwner,
  onCitationClick,
  sessions = [],
  activeSessionId,
  onSelectSession,
  onNewSession,
  onSaveMessage,
  onDeleteSession
}: { 
  documentTitle?: string,
  sourceCount?: number,
  messages: any[],
  setMessages: (m: any) => void,
  setSources: (s: any) => void,
  onRename?: (newTitle: string) => void,
  isOwner?: boolean,
  onCitationClick?: (id: string) => void,
  sessions?: any[],
  activeSessionId?: string | null,
  onSelectSession?: (id: string) => void,
  onNewSession?: () => void,
  onSaveMessage?: (role: string, content: string) => Promise<void>,
  onDeleteSession?: (id: string) => Promise<void>
}) => {
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [tempTitle, setTempTitle] = useState(documentTitle)
  const [showSessionsDropdown, setShowSessionsDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setTempTitle(documentTitle)
  }, [documentTitle])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowSessionsDropdown(false)
      }
    }
    if (showSessionsDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showSessionsDropdown])

  const handleRenameSubmit = () => {
    if (tempTitle.trim() && tempTitle !== documentTitle) {
      onRename?.(tempTitle)
    }
    setIsRenaming(false)
  }

  // --- Audio Input State ---
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<any>(null)

  // --- Audio Output State ---
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [ttsEnabled, setTtsEnabled] = useState(true)
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  // ── Speech Recognition Setup ──────────────────────────────────────────────
  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please try Chrome or Edge.")
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onstart = () => setIsListening(true)

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      setInput((prev) => prev ? prev + ' ' + transcript : transcript)
    }

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error)
      setIsListening(false)
    }

    recognition.onend = () => setIsListening(false)

    recognitionRef.current = recognition
    recognition.start()
  }

  const stopListening = () => {
    recognitionRef.current?.stop()
    setIsListening(false)
  }

  const toggleListening = () => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }

  // ── Text-to-Speech ────────────────────────────────────────────────────────
  const speak = (text: string) => {
    if (!ttsEnabled || !window.speechSynthesis) return

    // Cancel any ongoing speech
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    utterance.rate = 1.0
    utterance.pitch = 1.0

    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    currentUtteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }

  const stopSpeaking = () => {
    window.speechSynthesis?.cancel()
    setIsSpeaking(false)
  }

  const toggleTts = () => {
    if (isSpeaking) stopSpeaking()
    setTtsEnabled((prev) => !prev)
  }

  // Clean up on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
      window.speechSynthesis?.cancel()
    }
  }, [])

  // ── Send Message ──────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!input.trim() || isTyping) return

    // Stop listening if mic is active when sending
    if (isListening) stopListening()

    const userQuery = input.trim()
    setInput("")
    
    // Add user message to UI
    const newMessages = [...messages, { role: 'user', content: userQuery }]
    setMessages(newMessages)
    setIsTyping(true)
    
    // Track the session ID explicitly to avoid React closure traps after the long await
    let currentSessionId = activeSessionId;

    if (onSaveMessage) {
      currentSessionId = await onSaveMessage('user', userQuery, currentSessionId).catch(console.error) || currentSessionId;
    }

    try {
      const response = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userQuery }),
      })

      if (!response.ok) throw new Error("Backend API error")

      const data = await response.json()

      // Update messages with AI response
      setMessages([...newMessages, { role: 'assistant', content: data.answer }])
      
      // Update the sources list for the right panel
      setSources(data.sources)
      
      if (onSaveMessage) {
        await onSaveMessage('assistant', data.answer, currentSessionId).catch(console.error);
      }

      // Auto-speak the answer if TTS is enabled
      speak(data.answer)

    } catch (error) {
      console.error("Chat Error:", error)
      const errMsg = "Sorry, I encountered an error connecting to the RAG backend."
      setMessages([...newMessages, { role: 'assistant', content: errMsg }])
      speak(errMsg)
      
      if (onSaveMessage) {
        await onSaveMessage('assistant', errMsg, currentSessionId).catch(console.error);
      }
    } finally {
      setIsTyping(false)
    }
  }

  // Pre-process content to convert [pXX:id] into functional markdown links
  const processContent = (content: string) => {
    if (!content) return "";
    let processed = content;
    // 1. Convert [pXX:id] to [pXX:id](citation:pXX:id)
    processed = processed.replace(/\[(p\d+:[\w-]+)\]/g, '[$1](citation:$1)');
    // 2. If the LLM generated [text](pXX:id), change href to citation:
    processed = processed.replace(/\]\((p\d+:[\w-]+)\)/g, '](citation:$1)');
    // 3. Find raw pXX:id that are NOT preceded by `[` or `citation:` and wrap them
    processed = processed.replace(/(?<!\[|:)(p\d+:[\w-]+)/g, '[$1](citation:$1)');
    return processed;
  }

  // Helper: get a preview of session content for display
  const getSessionPreview = (session: any) => {
    return session.title || "New Chat"
  }

  return (
    <div className="flex flex-col h-full relative">
      {/* Header */}
      <div className="grid grid-cols-3 items-center p-4 border-b border-border/30">
        <div className="flex items-center gap-2 justify-start relative" ref={dropdownRef}>
          {/* Saved Chats - Three Dots Button (leftmost) */}
          <div className="relative">
            <button 
              className={cn(
                "p-2 rounded-lg transition-all duration-200",
                showSessionsDropdown 
                  ? "bg-primary/15 text-primary shadow-sm" 
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setShowSessionsDropdown(!showSessionsDropdown)}
              title="Saved chats"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            
            <AnimatePresence>
              {showSessionsDropdown && (
                <motion.div 
                  initial={{ opacity: 0, y: -4, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 mt-2 w-60 bg-card/95 backdrop-blur-xl border border-border/60 rounded-xl shadow-2xl z-50 overflow-hidden"
                >
                  {/* Dropdown Header */}
                  <div className="px-3 py-2 border-b border-border/30 flex justify-between items-center bg-muted/30">
                    <div className="flex items-center gap-1.5">
                      <MessageSquare className="w-3 h-3 text-primary" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/70">Chat History</span>
                    </div>
                    <button 
                      onClick={() => {
                        onNewSession?.();
                        setShowSessionsDropdown(false);
                      }}
                      className="p-1 hover:bg-primary/20 hover:text-primary rounded-md transition-all duration-200 group"
                      title="New Chat"
                    >
                      <Plus className="w-3 h-3 group-hover:rotate-90 transition-transform duration-200" />
                    </button>
                  </div>

                  {/* Session List */}
                  <div className="max-h-52 overflow-y-auto custom-scrollbar">
                    {sessions.length === 0 ? (
                      <div className="p-4 text-center space-y-1">
                        <MessageSquare className="w-6 h-6 text-muted-foreground/30 mx-auto" />
                        <p className="text-[11px] text-muted-foreground">No saved chats yet</p>
                        <p className="text-[10px] text-muted-foreground/60">Start a conversation to see it here</p>
                      </div>
                    ) : (
                      <div className="py-0.5">
                        {sessions.map((s) => (
                          <div 
                            key={s.id}
                            className={cn(
                              "w-full flex items-center gap-2 px-3 py-1.5 transition-all duration-150 group",
                              activeSessionId === s.id 
                                ? "bg-primary/10 border-l-2 border-primary" 
                                : "hover:bg-muted/60 border-l-2 border-transparent"
                            )}
                          >
                            <button
                              onClick={() => {
                                onSelectSession?.(s.id);
                                setShowSessionsDropdown(false);
                              }}
                              className="flex items-center gap-2 flex-1 min-w-0 text-left"
                            >
                              <div className={cn(
                                "w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0",
                                activeSessionId === s.id
                                  ? "bg-primary/20 text-primary"
                                  : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                              )}>
                                <MessageSquare className="w-2.5 h-2.5" />
                              </div>
                              <p className={cn(
                                "text-xs truncate leading-tight",
                                activeSessionId === s.id ? "font-semibold text-primary" : "text-foreground/80"
                              )}>
                                {getSessionPreview(s)}
                              </p>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteSession?.(s.id);
                              }}
                              className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-500/15 hover:text-red-500 text-muted-foreground/50 transition-all duration-150 flex-shrink-0"
                              title="Delete chat"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* TTS Toggle Button */}
          <button
            id="tts-toggle-btn"
            onClick={toggleTts}
            title={ttsEnabled ? "Disable text-to-speech" : "Enable text-to-speech"}
            className={cn(
              "p-2 rounded-lg transition-colors",
              ttsEnabled ? "bg-primary/10 text-primary hover:bg-primary/20" : "hover:bg-muted text-muted-foreground"
            )}
          >
            {isSpeaking ? (
              <Volume2 className="w-4 h-4 animate-pulse" />
            ) : ttsEnabled ? (
              <Volume2 className="w-4 h-4" />
            ) : (
              <VolumeX className="w-4 h-4" />
            )}
          </button>
        </div>

        <div className="flex justify-center min-w-0">
          {isRenaming ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                className="bg-muted/30 border border-primary/50 rounded-lg px-3 py-1 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 w-full max-w-[200px]"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameSubmit()
                  if (e.key === 'Escape') setIsRenaming(false)
                }}
              />
              <button onClick={handleRenameSubmit} className="p-1.5 hover:text-green-500 transition-colors bg-green-500/10 rounded-lg">
                <Check className="w-4 h-4" />
              </button>
              <button onClick={() => setIsRenaming(false)} className="p-1.5 hover:text-red-500 transition-colors bg-red-500/10 rounded-lg">
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <h2 className="text-xl font-bold tracking-tight text-center truncate">{documentTitle}</h2>
              {isOwner && (
                <button 
                  onClick={() => setIsRenaming(true)}
                  className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-muted rounded-lg transition-all"
                >
                  <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
          )}
        </div>
        
        <div className="flex justify-end">
          {/* Empty to balance the grid */}
        </div>
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-6 max-w-md mx-auto">
            <div className="space-y-4">
              <h3 className="text-3xl font-bold tracking-tight text-foreground">Start asking your queries</h3>
              <p className="text-muted-foreground max-w-xs mx-auto text-sm leading-relaxed">
                Interact with your documents using Adani QueryAI. Ask questions, get summaries, or find specific information.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <AnimatePresence mode="popLayout">
              {messages.map((m, i) => (
                <motion.div 
                   initial={{ opacity: 0, y: 10 }}
                   animate={{ opacity: 1, y: 0 }}
                   key={i} 
                   className={cn("flex gap-4 group", m.role === 'user' ? "flex-row-reverse" : "flex-row")}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold shadow-sm",
                    m.role === 'user' ? "bg-primary-gradient text-white" : "bg-muted border border-border"
                  )}>
                    {m.role === 'user' ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4 text-primary" />}
                  </div>
                  <div className={cn(
                    "max-w-[85%] px-4 py-2 rounded-2xl text-[15px] leading-relaxed shadow-sm",
                    m.role === 'user' ? "bg-primary-gradient text-white" : "bg-muted border border-border/50 text-foreground"
                  )}>
                    {m.role === 'user' ? (
                      <div className="whitespace-pre-wrap">{m.content}</div>
                    ) : (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          a: ({ node, href, children }) => {
                            let citationId = null;
                            const hrefStr = String(href || '');
                            if (hrefStr.startsWith('citation:')) {
                              citationId = hrefStr.replace('citation:', '');
                            } else {
                              const match = hrefStr.match(/p\d+:[\w-]+/);
                              if (match) {
                                citationId = match[0];
                              } else {
                                // Fallback: check children text just in case
                                const childStr = String(children || '');
                                const childMatch = childStr.match(/p\d+:[\w-]+/);
                                if (childMatch) {
                                  citationId = childMatch[0];
                                }
                              }
                            }

                            if (citationId) {
                              return (
                                <button 
                                  className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[11px] font-mono bg-primary/10 border border-primary/20 text-primary hover:bg-primary hover:text-white mx-0.5 my-0.5 transition-all duration-200 cursor-pointer"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (onCitationClick) onCitationClick(citationId);
                                  }}
                                  title={`View source ${citationId}`}
                                >
                                  {children}
                                </button>
                              )
                            }
                            return <a href={hrefStr} target="_blank" rel="noreferrer" className="text-primary hover:underline">{children}</a>
                          },

                          table: ({ node, ...props }) => (
                            <div className="overflow-x-auto my-4 rounded-xl border border-border/50 bg-muted/20">
                              <table className="w-full text-sm border-collapse" {...props} />
                            </div>
                          ),
                          th: ({ node, ...props }) => <th className="border-b border-r border-border/50 px-4 py-3 bg-muted/50 font-semibold text-left last:border-r-0" {...props} />,
                          td: ({ node, ...props }) => <td className="border-b border-r border-border/50 px-4 py-3 last:border-r-0" {...props} />,
                          p: ({ node, ...props }) => <p className="mb-4 last:mb-0" {...props} />,
                          ul: ({ node, ...props }) => <ul className="list-disc pl-6 mb-4 space-y-1" {...props} />,
                          ol: ({ node, ...props }) => <ol className="list-decimal pl-6 mb-4 space-y-1" {...props} />,
                          li: ({ node, ...props }) => <li className="" {...props} />,
                          strong: ({ node, ...props }) => <strong className="font-semibold text-primary/90" {...props} />
                        }}
                      >
                        {processContent(m.content)}
                      </ReactMarkdown>
                    )}

                    {/* Replay TTS button on AI messages */}
                    {m.role === 'assistant' && (
                      <button
                        onClick={() => speak(m.content)}
                        title="Read aloud"
                        className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Volume2 className="w-3 h-3" />
                        Read aloud
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {isTyping && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4 items-center pl-1">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
                <div className="text-xs text-muted-foreground animate-pulse font-medium">AI is analyzing sources...</div>
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 pt-0">
        <div className="max-w-3xl mx-auto relative group">
          <div className="absolute -inset-0.5 bg-primary-gradient rounded-full blur opacity-0 group-focus-within:opacity-100 transition duration-500" />
          <div className="relative flex items-center bg-card border border-border/50 rounded-full p-1.5 pr-3 shadow-xl focus-within:border-primary/50 transition-all">
            <div className="pl-4 pr-2">
              <Sparkles className="w-5 h-5 text-primary/60" />
            </div>
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={isListening ? "Listening... speak now" : "Start typing or use the mic..."}
              className="flex-1 bg-transparent border-none outline-none py-2 text-[15px] placeholder:text-muted-foreground/40"
            />
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-tighter">
                {sourceCount} {sourceCount === 1 ? 'source' : 'sources'}
              </span>

              {/* Mic Button */}
              <button
                id="mic-input-btn"
                onClick={toggleListening}
                disabled={isTyping}
                title={isListening ? "Stop listening" : "Speak your question"}
                className={cn(
                  "p-2 rounded-full transition-all",
                  isListening 
                    ? "bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/40" 
                    : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary",
                  isTyping && "opacity-50 cursor-not-allowed"
                )}
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              {/* Send Button */}
              <button 
                id="send-message-btn"
                onClick={handleSend}
                disabled={isTyping || !input.trim()}
                className="p-2 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
