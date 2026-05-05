"use client"

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/authStore';
import { FileText, ExternalLink, Shield, Loader2 } from 'lucide-react';
import { ScanningLoader } from '@/components/ScanningLoader';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { getDocuments } from '@/lib/actions';

export default function DashboardPage() {
  const { role } = useAuthStore();
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchDocs() {
      if (!role) return;
      setLoading(true);
      try {
        const docs = await getDocuments(role);
        setDocuments(docs);
      } catch (error) {
        console.error("Error fetching documents:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchDocs();
  }, [role]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Uploaded Documents</h1>
          <p className="text-muted-foreground">Access and interact with your shared document workspaces</p>
        </div>
        <div />
      </div>

      {loading ? (
        <div className="py-20">
          <ScanningLoader />
        </div>
      ) : documents.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {documents.map((doc, index) => (
            <motion.div 
              key={doc.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => router.push(`/notebook/${doc.id}`)}
              className="group relative bg-card border border-border/50 hover:border-primary/50 p-6 rounded-3xl transition-all shadow-sm hover:shadow-xl hover:-translate-y-1 flex flex-col h-52 cursor-pointer overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
                <FileText className="w-24 h-24 text-primary" />
              </div>

              <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="p-3 rounded-2xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <div className="text-[10px] font-bold bg-muted/50 px-2 py-1 rounded-md text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                  {doc.fileUrls?.length || 0} SOURCES
                </div>
              </div>
              
              <div className="mt-auto space-y-1 relative z-10">
                <h3 className="font-bold text-lg truncate group-hover:text-primary transition-colors">{doc.title}</h3>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground font-medium">
                    {new Date(doc.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/0 group-hover:text-primary group-hover:opacity-100 transition-all" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-muted/5 rounded-3xl border border-dashed border-border/50">
          <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">No documents available for your role</p>
        </div>
      )}
    </div>
  );
}
