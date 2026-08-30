'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  SearchIcon,
  HelpIcon,
  ChevronDownIcon,
  SunIcon,
  MoonIcon,
  MenuIcon,
} from '@/components/ui/Icons'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/Toast'

interface HeaderProps {
  onOpenMobileSidebar?: () => void
}

export default function Header({ onOpenMobileSidebar }: HeaderProps) {
  const router = useRouter()
  const { success } = useToast()
  const [query, setQuery] = useState('')
  const [userName, setUserName] = useState('Alex Johnson')
  const [userAvatar, setUserAvatar] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserName(
          user.user_metadata?.display_name ||
            user.user_metadata?.full_name ||
            user.email?.split('@')[0] ||
            'Alex Johnson'
        )
        setUserEmail(user.email || '')
        setUserAvatar(user.user_metadata?.avatar_url || '')
      }
    })

    const stored = localStorage.getItem('theme')
    // Default to light theme. Only go dark if user explicitly chose dark.
    const isDark = stored === 'dark'
    setDarkMode(isDark)
    document.documentElement.classList.toggle('dark', isDark)

    // Global Cmd+K keyboard shortcut
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        const searchInput = document.getElementById('global-search-input')
        searchInput?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const toggleDarkMode = () => {
    const nextDark = !document.documentElement.classList.contains('dark')
    setDarkMode(nextDark)
    document.documentElement.classList.toggle('dark', nextDark)
    localStorage.setItem('theme', nextDark ? 'dark' : 'light')
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    success('Logged out successfully')
    router.push('/login')
  }

  return (
    <header className="h-16 border-b border-[#eee9e2] dark:border-stone-800 bg-white/80 dark:bg-stone-900/80 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-8 flex items-center justify-between transition-colors">
      {/* Mobile Hamburger & Search Input */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        {onOpenMobileSidebar && (
          <button
            onClick={onOpenMobileSidebar}
            className="md:hidden p-2 rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            <MenuIcon className="w-5 h-5" />
          </button>
        )}

        <form onSubmit={handleSearchSubmit} className="relative w-full max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
            <SearchIcon className="w-4 h-4" />
          </div>
          <input
            id="global-search-input"
            type="text"
            placeholder="Search issues, projects, users..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-12 py-2 text-sm bg-stone-100/80 dark:bg-stone-800/80 border border-transparent focus:border-orange-500/40 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 text-stone-900 dark:text-stone-100 placeholder-stone-400 transition-all"
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <kbd className="px-1.5 py-0.5 text-xs font-mono font-medium text-stone-400 bg-white dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded">
              {typeof navigator !== 'undefined' && navigator.platform?.includes('Mac') ? '⌘K' : 'Ctrl+K'}
            </kbd>
          </div>
        </form>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Dark Mode Toggle */}
        <button
          type="button"
          onClick={toggleDarkMode}
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          className="p-2 rounded-xl text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
        >
          {darkMode ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
        </button>

        {/* Help Icon */}
        <button
          onClick={() =>
            success('BugNexus Help', 'Press ⌘K to search or click any bug to view triage details.')
          }
          className="p-2 rounded-xl text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
        >
          <HelpIcon className="w-4 h-4" />
        </button>

        {/* User Profile Pill */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2.5 pl-2 pr-1 py-1 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-stone-800 text-white flex items-center justify-center font-medium text-xs overflow-hidden border border-stone-200 dark:border-stone-700">
              {userAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={userAvatar}
                  alt={userName}
                  className="w-full h-full object-cover"
                />
              ) : (
                userName.charAt(0).toUpperCase()
              )}
            </div>
            <span className="hidden sm:inline text-xs font-semibold text-stone-800 dark:text-stone-200">
              {userName}
            </span>
            <ChevronDownIcon className="w-3.5 h-3.5 text-stone-400" />
          </button>

          {/* Dropdown Menu */}
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-stone-900 rounded-2xl shadow-xl border border-[#eee9e2] dark:border-stone-800 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-4 py-2 border-b border-[#eee9e2] dark:border-stone-800">
                <div className="text-xs font-bold text-stone-900 dark:text-white truncate">
                  {userName}
                </div>
                <div className="text-xs text-stone-400 truncate mt-0.5">
                  {userEmail || 'alex.johnson@company.com'}
                </div>
              </div>
              <button
                onClick={() => {
                  setMenuOpen(false)
                  router.push('/bugs/new')
                }}
                className="w-full text-left px-4 py-2 text-xs text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                + New Issue
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false)
                  router.push('/bugs')
                }}
                className="w-full text-left px-4 py-2 text-xs text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                My Issues
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false)
                  router.push('/settings')
                }}
                className="w-full text-left px-4 py-2 text-xs text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                Settings
              </button>
              <div className="my-1 border-t border-[#eee9e2] dark:border-stone-800" />
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
