"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/authStore'
import { Loader2 } from 'lucide-react'

export default function LandingPage() {
  const router = useRouter()
  const { user, loading, init } = useAuthStore()

  useEffect(() => {
    init()
  }, [])

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.push('/dashboard')
      } else {
        router.push('/login')
      }
    }
  }, [user, loading, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-2xl animate-pulse p-2">
          <img 
            src="https://res.cloudinary.com/dktgnnqia/image/upload/v1777817754/Adani_2012_logo-removebg-preview_n7pgul.png" 
            alt="Adani Logo" 
            className="w-full h-full object-contain"
          />
        </div>
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    </div>
  )
}
