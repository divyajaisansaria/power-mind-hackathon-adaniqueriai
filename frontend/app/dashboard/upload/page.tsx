"use client"

import { useState } from 'react';
import { auth } from '@/lib/firebase';
import { uploadDocumentAction } from '@/lib/actions';
import { Upload, FileText, CheckCircle2, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AdminUploadPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [allowedRoles, setAllowedRoles] = useState<string[]>(['ADMIN']);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [success, setSuccess] = useState(false);

  const handleRoleToggle = (role: string) => {
    setAllowedRoles(prev => 
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) return;
    
    setIsUploading(true);
    setSuccess(false);
    setProgress(0);

    try {
      const { uploadToCloudinaryAction } = await import('@/lib/actions');

      const uploadUrls: string[] = [];
      let completedCount = 0;

      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        
        const result = await uploadToCloudinaryAction(formData);

        if (result.success && result.url) {
          uploadUrls.push(result.url);
          completedCount++;
          setProgress((completedCount / files.length) * 100);
        } else {
          throw new Error(result.error || "Failed to upload file to Cloudinary");
        }
      }

      const result = await uploadDocumentAction({
        title: files[0].name.replace(/\.[^/.]+$/, ""), 
        fileUrls: uploadUrls,
        allowedRoles,
        firebaseUid: auth.currentUser?.uid || ''
      });

      if (result.success) {
        setIsUploading(false);
        setSuccess(true);
        setFiles([]);
        setAllowedRoles(['ADMIN']);
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      alert(`Upload failed: ${error.message}`);
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Bulk Upload Documents</h1>
        <p className="text-muted-foreground">Select a folder or multiple PDFs to upload new documents</p>
      </div>

      <form onSubmit={handleUpload} className="space-y-6 bg-card border border-border/50 p-8 rounded-3xl">
        <div className="space-y-2">
          <label className="text-sm font-medium">Select Folder or PDF Files</label>
          <div className="relative border-2 border-dashed border-border/50 rounded-xl p-8 flex flex-col items-center justify-center space-y-4 hover:bg-muted/5 transition-colors">
            <input 
              type="file" 
              accept=".pdf"
              multiple
              webkitdirectory="" 
              directory=""
              onChange={(e) => {
                const selected = e.target.files;
                if (selected) {
                  setFiles(Array.from(selected).filter(f => f.name.toLowerCase().endsWith('.pdf')));
                }
              }}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <Upload className="w-8 h-8 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium">
                {files.length > 0 ? `${files.length} files selected` : "Click to select folder or drag PDFs"}
              </p>
              <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">PDF ONLY</p>
            </div>
          </div>
          {files.length > 0 && (
            <div className="max-h-32 overflow-y-auto space-y-1 pt-2">
              {files.slice(0, 5).map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <FileText className="w-3 h-3" />
                  {f.name}
                </div>
              ))}
              {files.length > 5 && <div className="text-[10px] text-muted-foreground italic">...and {files.length - 5} more</div>}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <label className="text-sm font-medium">Assign Access Roles</label>
          <div className="grid grid-cols-3 gap-4">
            {['ADMIN', 'MANAGER', 'INTERN'].map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => handleRoleToggle(role)}
                disabled={role === 'ADMIN'}
                className={cn(
                  "py-3 px-4 rounded-xl border transition-all text-sm font-medium capitalize",
                  allowedRoles.includes(role) 
                    ? "bg-primary/20 border-primary text-primary" 
                    : "bg-muted/20 border-border/50 text-muted-foreground"
                )}
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        {isUploading && (
          <div className="space-y-2">
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-center text-muted-foreground">Uploading... {progress}%</p>
          </div>
        )}

        {success && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center justify-center gap-2 text-green-500 font-medium"
          >
            <CheckCircle2 className="w-5 h-5" />
            Document(s) uploaded successfully!
          </motion.div>
        )}

        <button 
          type="submit"
          disabled={isUploading || files.length === 0}
          className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isUploading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : `Upload ${files.length} PDF(s)`}
        </button>
      </form>
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
