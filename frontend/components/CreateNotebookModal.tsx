"use client"

import React, { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Search, Upload, Globe, Database, Type, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { db, storage, auth } from '@/lib/firebase'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'

interface CreateDocumentModalProps {
  isOpen: boolean
  onClose: () => void
}

export const CreateDocumentModal = ({ isOpen, onClose }: CreateDocumentModalProps) => {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [allowedRoles, setAllowedRoles] = useState<string[]>(['admin', 'manager'])

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    setUploadStatus('uploading')
    setUploadProgress(0)

    const file = files[0] // Handling one file for now in this modal for simplicity
    const title = file.webkitRelativePath?.split('/')[0] || file.name.replace('.pdf', '')

    try {
      const storageRef = ref(storage, `documents/${Date.now()}_${file.name}`)
      const uploadTask = uploadBytesResumable(storageRef, file)

      uploadTask.on('state_changed', 
        (snapshot) => {
          const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(Math.round(p));
        }, 
        (error) => {
          console.error("Upload error:", error);
          setUploadStatus('error');
          setIsUploading(false);
        }, 
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          
          const docRef = await addDoc(collection(db, 'documents'), {
            title,
            fileUrl: downloadURL,
            uploadedBy: auth.currentUser?.uid,
            allowedRoles,
            createdAt: serverTimestamp(),
          });

          setUploadStatus('success');
          setIsUploading(false);
          
          setTimeout(() => {
            onClose();
            router.push('/dashboard');
          }, 1500);
        }
      );
    } catch (error) {
      console.error('Firebase upload error:', error);
      setUploadStatus('error');
      setIsUploading(false);
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
          />
          
          {/* Modal Container */}
          <div className="fixed inset-0 flex items-center justify-center z-[60] p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-card border border-border shadow-2xl rounded-3xl overflow-hidden"
            >
              {/* Header */}
              <div className="p-8 pb-4 flex justify-between items-start">
                <div className="space-y-1">
                  <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">
                    Generate Insights from
                  </h2>
                  <h2 className="text-3xl font-bold tracking-tight text-primary/60">your pdf</h2>
                </div>
                <button 
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-muted transition-colors"
                >
                  <X className="w-6 h-6 text-muted-foreground" />
                </button>
              </div>

              {/* Content */}
              <div className="p-8 pt-4 space-y-8">
                {/* Grid of options */}
                <div className="relative p-12 border-2 border-dashed border-muted-foreground/20 rounded-3xl bg-muted/5 flex flex-col items-center justify-center space-y-6">
                  <div className="text-center space-y-1">
                    <p className="text-xl font-medium">drop your files or</p>
                    <p className="text-sm text-muted-foreground">pdf</p>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4 w-full">
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      multiple
                      accept=".pdf"
                      {...({
                        webkitdirectory: "",
                        directory: ""
                      } as any)}
                      onChange={handleFileChange}
                    />
                    
                    <OptionButton 
                      icon={isUploading ? <Loader2 className="animate-spin" /> : <Upload />} 
                      label={isUploading ? `Uploading... ${uploadProgress}%` : "Upload files"} 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                    />
                  </div>

                  {uploadStatus === 'success' && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 text-green-500 text-sm font-medium"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Files uploaded successfully!
                    </motion.div>
                  )}

                  {uploadStatus === 'error' && (
                    <p className="text-destructive text-sm font-medium">
                      Upload failed. Please check your Cloudinary settings.
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}

const OptionButton = ({ icon, label, onClick, disabled }: { icon: React.ReactNode, label: string, onClick?: () => void, disabled?: boolean }) => (
  <button 
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-muted/50 border border-border transition-all text-sm font-medium w-full",
      disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-muted hover:border-muted-foreground/30"
    )}
  >
    {React.cloneElement(icon as React.ReactElement, { className: "w-4 h-4" })}
    {label}
  </button>
)
