'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BugIcon,
  DashboardIcon,
  IssuesIcon,
  TriageIcon,
  GraphIcon,
  AnalyticsIcon,
  ReportsIcon,
  ProjectsIcon,
  TeamsIcon,
  SettingsIcon,
  ChevronDownIcon,
  XIcon,
} from '@/components/ui/Icons'
import { supabase } from '@/lib/supabase'

interface SidebarProps {
  mobileOpen?: boolean
  onCloseMobile?: () => void
}

export default function Sidebar({ mobileOpen = false, onCloseMobile }: SidebarProps) {
  const pathname = usePathname()
  const [userName, setUserName] = useState('Alex Johnson')
  const [userRole, setUserRole] = useState('Administrator')
  const [userAvatar, setUserAvatar] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserName(
          user.user_metadata?.display_name ||
            user.user_metadata?.full_name ||
            user.email?.split('@')[0] ||
            'Alex Johnson'
        )
        setUserRole(user.user_metadata?.role || 'Administrator')
        setUserAvatar(user.user_metadata?.avatar_url || '')
      }
    })
  }, [])

  const navItems = [
    { label: 'Dashboard', href: '/', icon: DashboardIcon },
    { label: 'Issues', href: '/bugs', icon: IssuesIcon },
    { label: 'Triage', href: '/bugs?status=NEW', icon: TriageIcon, badge: '12' },
    { label: 'Graph', href: '/graph', icon: GraphIcon },
    { label: 'Analytics', href: '/analytics', icon: AnalyticsIcon },
    { label: 'Reports', href: '/reports', icon: ReportsIcon },
    { label: 'Projects', href: '/projects', icon: ProjectsIcon },
    { label: 'Teams', href: '/teams', icon: TeamsIcon },
    { label: 'Settings', href: '/settings', icon: SettingsIcon },
  ]

  const sidebarContent = (
    <div className="h-full flex flex-col justify-between bg-white dark:bg-stone-900 border-r border-[#eee9e2] dark:border-stone-800 w-64 select-none">
      {/* Brand Header */}
      <div>
        <div className="p-6 pb-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-orange-500/10 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center transition-transform group-hover:scale-105">
              <BugIcon className="w-5 h-5 text-orange-600 dark:text-orange-500" />
            </div>
            <div>
              <div className="font-bold text-lg text-stone-900 dark:text-white tracking-tight leading-none">
                BugFlow
              </div>
              <div className="text-xs text-stone-400 dark:text-stone-500 font-medium tracking-wide mt-1">
                Track • Triage • Resolve
              </div>
            </div>
          </Link>
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="md:hidden p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
            >
              <XIcon className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="px-3 mt-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href) && item.href !== '/'

            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={onCloseMobile}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-[#ea580c] text-white shadow-sm shadow-orange-500/20'
                    : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100/80 dark:hover:bg-stone-800/60 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-white' : 'text-stone-500 dark:text-stone-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-400'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* User Footer Profile */}
      <div className="p-3 border-t border-[#eee9e2] dark:border-stone-800">
        <div className="flex items-center justify-between p-2 rounded-xl hover:bg-stone-100/80 dark:hover:bg-stone-800/60 cursor-pointer transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-stone-700 to-stone-500 text-white flex items-center justify-center font-medium text-xs overflow-hidden border border-stone-200 dark:border-stone-700">
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
            <div className="text-left">
              <div className="text-xs font-semibold text-stone-900 dark:text-white line-clamp-1">
                {userName}
              </div>
              <div className="text-xs text-stone-400 dark:text-stone-500">
                {userRole}
              </div>
            </div>
          </div>
          <ChevronDownIcon className="w-3.5 h-3.5 text-stone-400" />
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:block h-screen sticky top-0 shrink-0 z-20">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 w-64 h-full animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  )
}