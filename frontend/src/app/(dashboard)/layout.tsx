'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import { ToastProvider } from '@/components/ui/Toast'
import { supabase } from '@/lib/supabase'
import { api } from '@/lib/api'

// Vercel injects the deployed commit SHA; empty in local dev.
const BUILD_SHA = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA
  ? process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA.slice(0, 7)
  : ''

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    const timer = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace('/login')
      } else {
        setAuthChecked(true)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [router])

  // Warm the shared API cache while the user reads the landing page, so the
  // Graph and Projects views render instantly on first click.
  useEffect(() => {
    if (!authChecked) return
    const t = setTimeout(() => {
      api.getGraph().catch(() => {})
      api.getProjects().catch(() => {})
    }, 1200)
    return () => clearTimeout(t)
  }, [authChecked])

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#121110] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-stone-400 mt-3">Checking authentication...</p>
        </div>
      </div>
    )
  }

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-[#f8f6f3] dark:bg-[#121110] text-stone-900 dark:text-stone-100 selection:bg-orange-500 selection:text-white transition-colors duration-150">
        <Sidebar
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <Header onOpenMobileSidebar={() => setMobileOpen(true)} />
          <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
            {children}
          </main>
          <footer className="pb-4 text-center">
            <span className="text-[11px] font-mono text-stone-400">
              build {BUILD_SHA}
            </span>
          </footer>
        </div>
      </div>
    </ToastProvider>
  )
}