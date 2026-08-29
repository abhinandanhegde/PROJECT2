'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import { ToastProvider } from '@/components/ui/Toast'
import { supabase } from '@/lib/supabase'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login')
      } else {
        setAuthChecked(true)
      }
    })
  }, [router])

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
        <Suspense fallback={<div className="w-64 shrink-0 hidden md:block" />}>
          <Sidebar
            mobileOpen={mobileOpen}
            onCloseMobile={() => setMobileOpen(false)}
          />
        </Suspense>
        <div className="flex-1 flex flex-col min-w-0">
          <Header onOpenMobileSidebar={() => setMobileOpen(true)} />
          <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}