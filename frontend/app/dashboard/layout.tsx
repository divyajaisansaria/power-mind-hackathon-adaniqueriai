"use client"

import React, { useEffect } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { LayoutDashboard, Upload, Users, LogOut, Library, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuthStore } from '@/lib/authStore';

import { ThemeToggle } from '@/components/ThemeToggle';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { role, init, user, error } = useAuthStore();

  useEffect(() => {
    init();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 text-center">
        <div className="max-w-md space-y-8 bg-card border border-red-500/20 p-10 rounded-[3rem] shadow-2xl">
          <div className="relative mx-auto w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center">
            <div className="absolute inset-0 bg-red-500/20 blur-xl rounded-full animate-pulse" />
            <ShieldAlert className="relative w-10 h-10 text-red-500" />
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight">Access Restricted</h1>
            <p className="text-muted-foreground leading-relaxed">
              {error}
            </p>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full py-4 px-6 bg-muted hover:bg-muted/80 rounded-2xl font-bold transition-all"
          >
            Sign out and try another account
          </button>
        </div>
      </div>
    );
  }

  const menuItems = [
    { label: 'Uploaded Documents', icon: Library, href: '/dashboard', roles: ['ADMIN', 'MANAGER', 'INTERN'] },
    { label: 'Upload Documents', icon: Upload, href: '/dashboard/upload', roles: ['ADMIN'] },
    { label: 'Manage Users', icon: Users, href: '/dashboard/users', roles: ['ADMIN'] },
  ];

  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-background text-foreground">
        {/* Sidebar */}
        <aside className="w-72 border-r border-border/30 flex flex-col p-6 space-y-8">
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center bg-white shadow-lg">
              <img 
                src="https://res.cloudinary.com/dktgnnqia/image/upload/v1777817754/Adani_2012_logo-removebg-preview_n7pgul.png" 
                alt="Adani Logo" 
                className="w-full h-full object-contain p-1"
              />
            </div>
            <div>
              <h1 className="font-bold tracking-tight">Adani QueryAI</h1>
              <p className="text-[10px] uppercase tracking-widest text-primary font-bold">{role || 'Loading...'}</p>
            </div>
          </div>

          <nav className="flex-1 space-y-2">
            <div className="px-4 pb-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Explore
            </div>

            {menuItems.map((item) => {
              // Only show items allowed for current role
              if (role && !item.roles.includes(role)) return null;
              
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium",
                    isActive 
                      ? "bg-primary/10 text-primary border border-primary/20 shadow-lg shadow-primary/5" 
                      : "text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  <item.icon className={cn("w-4 h-4", isActive ? "text-primary" : "text-muted-foreground")} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* User Profile Summary */}
          <div className="mt-auto pt-6 border-t border-border/30 flex items-center justify-between">
            <ThemeToggle />
            <button 
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-400/10 transition-colors text-sm font-medium"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-8 relative">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
