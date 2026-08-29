'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function SettingsPage() {
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [emailNotifs, setEmailNotifs] = useState(true)
  const [autoAssign, setAutoAssign] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserName(user.user_metadata?.display_name || user.email?.split('@')[0] || '')
        setUserEmail(user.email || '')
      }
    })
  }, [])

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <div className="flex items-center gap-2 text-xs text-stone-500 mb-1">
          <Link href="/" className="hover:underline">Dashboard</Link>
          <span>/</span>
          <span className="text-stone-900 dark:text-white font-medium">Settings</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-white">
          Settings
        </h1>
        <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
          Manage your profile and preferences.
        </p>
      </div>

      {/* Profile */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl p-6 border border-[#eee9e2] dark:border-stone-800 shadow-sm">
        <h2 className="font-bold text-base text-stone-900 dark:text-white mb-4">Profile</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1">Name</label>
            <input type="text" value={userName} readOnly className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800 text-sm text-stone-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1">Email</label>
            <input type="email" value={userEmail} readOnly className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800 text-sm text-stone-900 dark:text-white" />
          </div>
        </div>
      </div>

      {/* Preferences */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl p-6 border border-[#eee9e2] dark:border-stone-800 shadow-sm">
        <h2 className="font-bold text-base text-stone-900 dark:text-white mb-4">Preferences</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-stone-900 dark:text-white">Email Notifications</div>
              <div className="text-xs text-stone-500 dark:text-stone-400">Receive email alerts for assigned bugs</div>
            </div>
            <button type="button" onClick={() => setEmailNotifs(!emailNotifs)} className={`w-10 h-6 rounded-full relative cursor-pointer transition-colors ${emailNotifs ? 'bg-orange-500' : 'bg-stone-300 dark:bg-stone-600'}`}>
              <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 shadow-sm transition-transform ${emailNotifs ? 'right-0.5' : 'left-0.5'}`} />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-stone-900 dark:text-white">Auto-assign on Status Change</div>
              <div className="text-xs text-stone-500 dark:text-stone-400">Automatically assign bug to last commenter</div>
            </div>
            <button type="button" onClick={() => setAutoAssign(!autoAssign)} className={`w-10 h-6 rounded-full relative cursor-pointer transition-colors ${autoAssign ? 'bg-orange-500' : 'bg-stone-300 dark:bg-stone-600'}`}>
              <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 shadow-sm transition-transform ${autoAssign ? 'right-0.5' : 'left-0.5'}`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
