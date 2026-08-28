'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  DocumentIcon,
  FlagIcon,
  UserIcon,
  LockIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  CalendarIcon,
  MoreVerticalIcon,
} from '@/components/ui/Icons'
import { supabase } from '@/lib/supabase'
import { api } from '@/lib/api'

interface TriageItem {
  id: string
  code: string
  title: string
  component: string
  priority: 'P1' | 'P2' | 'P3'
  assignee: { name: string; avatar?: string } | null
  similarity: number
  age: string
}

interface ActivityItem {
  id: string
  dotColor: string
  actor: string
  action: string
  target: string
  timeAgo: string
}

interface ComponentStat {
  name: string
  issues: number
  riskLevel: 'High' | 'Medium' | 'Low'
  color: string
  percentage: number
}

interface StaleIssue {
  code: string
  title: string
  days: string
}

interface AssigneeStat {
  name: string
  avatar?: string
  issues: number
  percentage: number
}

function greetingForHour(hour: number) {
  if (hour < 5) return 'Good night'
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  if (hour < 22) return 'Good evening'
  return 'Good night'
}

export default function DashboardPage() {
  const [userName, setUserName] = useState('Alex')
  const [greeting, setGreeting] = useState(() =>
    greetingForHour(new Date().getHours())
  )

  // Real or mock metrics state
  const [stats, setStats] = useState({
    openIssues: 87,
    p1Issues: 6,
    unassigned: 4,
    blocked: 3,
  })

  useEffect(() => {
    setGreeting(greetingForHour(new Date().getHours()))

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const name =
          user.user_metadata?.display_name ||
          user.user_metadata?.full_name ||
          user.email?.split('@')[0] ||
          'Alex'
        setUserName(name)
      }
    })

    // Try fetching real dashboard stats
    api
      .getDashboardStats()
      .then((res) => {
        if (res && res.total_bugs_reported !== undefined) {
          setStats((prev) => ({
            ...prev,
            openIssues: res.open_assigned || prev.openIssues,
            p1Issues: res.bugs_by_severity?.['CRITICAL'] || res.bugs_by_severity?.['BLOCKER'] || prev.p1Issues,
          }))
        }
      })
      .catch(() => {
        // Fallback gracefully to high fidelity demo data
      })
  }, [])

  const triageItems: TriageItem[] = [
    {
      id: '1',
      code: 'BUG-184',
      title: 'Login crashes after session expires',
      component: 'Authentication',
      priority: 'P1',
      assignee: null,
      similarity: 91,
      age: '2h ago',
    },
    {
      id: '2',
      code: 'BUG-181',
      title: 'API returns 500 on payment process',
      component: 'Payments',
      priority: 'P1',
      assignee: { name: 'Rahul Sharma' },
      similarity: 78,
      age: '5h ago',
    },
    {
      id: '3',
      code: 'BUG-178',
      title: 'UI freezes on dashboard refresh',
      component: 'Frontend',
      priority: 'P2',
      assignee: { name: 'Priya Singh' },
      similarity: 65,
      age: '1d ago',
    },
    {
      id: '4',
      code: 'BUG-175',
      title: 'Email notifications not sent',
      component: 'Notifications',
      priority: 'P2',
      assignee: null,
      similarity: 40,
      age: '1d ago',
    },
  ]

  const recentActivities: ActivityItem[] = [
    {
      id: '1',
      dotColor: 'bg-emerald-500',
      actor: 'Rahul Sharma',
      action: 'changed status of',
      target: 'BUG-143',
      timeAgo: '2m ago',
    },
    {
      id: '2',
      dotColor: 'bg-blue-500',
      actor: 'Priya Singh',
      action: 'assigned',
      target: 'BUG-181 to herself',
      timeAgo: '15m ago',
    },
    {
      id: '3',
      dotColor: 'bg-orange-500',
      actor: 'Alex Johnson',
      action: 'created',
      target: 'BUG-184',
      timeAgo: '1h ago',
    },
    {
      id: '4',
      dotColor: 'bg-stone-400',
      actor: 'System',
      action: 'updated priority of',
      target: 'BUG-175',
      timeAgo: '3h ago',
    },
  ]

  const componentHealthList: ComponentStat[] = [
    {
      name: 'Authentication',
      issues: 23,
      riskLevel: 'High',
      color: 'bg-red-500',
      percentage: 75,
    },
    {
      name: 'Payments',
      issues: 15,
      riskLevel: 'Medium',
      color: 'bg-orange-500',
      percentage: 52,
    },
    {
      name: 'Frontend',
      issues: 8,
      riskLevel: 'Low',
      color: 'bg-amber-400',
      percentage: 28,
    },
    {
      name: 'Notifications',
      issues: 5,
      riskLevel: 'Low',
      color: 'bg-emerald-500',
      percentage: 16,
    },
  ]

  const staleIssues: StaleIssue[] = [
    {
      code: 'BUG-142',
      title: 'Session timeout not working',
      days: '9 days',
    },
    {
      code: 'BUG-129',
      title: 'Memory leak in data export',
      days: '8 days',
    },
    {
      code: 'BUG-118',
      title: 'CSV export fails on large data',
      days: '7 days',
    },
  ]

  const topAssignees: AssigneeStat[] = [
    {
      name: 'Rahul Sharma',
      issues: 18,
      percentage: 85,
    },
    {
      name: 'Priya Singh',
      issues: 12,
      percentage: 60,
    },
    {
      name: 'Mike Ross',
      issues: 8,
      percentage: 42,
    },
    {
      name: 'You',
      issues: 6,
      percentage: 30,
    },
  ]

  const currentDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div className="space-y-6">
      {/* Top Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 dark:text-white flex items-center gap-2">
            {greeting}, {userName}! <span className="animate-bounce">👋</span>
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
            Here&apos;s what&apos;s happening with your projects today.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white dark:bg-stone-900 border border-[#eee9e2] dark:border-stone-800 text-xs font-semibold text-stone-700 dark:text-stone-300 shadow-2xs">
            <CalendarIcon className="w-3.5 h-3.5 text-stone-400" />
            <span>{currentDate}</span>
          </div>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Open Issues */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl p-5 border border-[#eee9e2] dark:border-stone-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-stone-500 dark:text-stone-400">
              Open Issues
            </div>
            <div className="w-9 h-9 rounded-full bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 flex items-center justify-center">
              <DocumentIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-stone-900 dark:text-white mt-3">
            {stats.openIssues}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-3">
            <ArrowUpIcon className="w-3.5 h-3.5" />
            <span>12 vs last week</span>
          </div>
        </div>

        {/* P1 Issues */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl p-5 border border-[#eee9e2] dark:border-stone-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-stone-500 dark:text-stone-400">
              P1 Issues
            </div>
            <div className="w-9 h-9 rounded-full bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center">
              <FlagIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-stone-900 dark:text-white mt-3">
            {stats.p1Issues}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-3">
            <ArrowUpIcon className="w-3.5 h-3.5" />
            <span>2 vs last week</span>
          </div>
        </div>

        {/* Unassigned */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl p-5 border border-[#eee9e2] dark:border-stone-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-stone-500 dark:text-stone-400">
              Unassigned
            </div>
            <div className="w-9 h-9 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <UserIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-stone-900 dark:text-white mt-3">
            {stats.unassigned}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-3">
            <ArrowDownIcon className="w-3.5 h-3.5" />
            <span>3 vs last week</span>
          </div>
        </div>

        {/* Blocked */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl p-5 border border-[#eee9e2] dark:border-stone-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-stone-500 dark:text-stone-400">
              Blocked
            </div>
            <div className="w-9 h-9 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <LockIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-stone-900 dark:text-white mt-3">
            {stats.blocked}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-3">
            <ArrowDownIcon className="w-3.5 h-3.5" />
            <span>1 vs last week</span>
          </div>
        </div>
      </div>

      {/* Middle Grid: Triage Queue (Left) & Project Health / Recent Activity (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Triage Queue (2 cols wide) */}
        <div className="lg:col-span-2 bg-white dark:bg-stone-900 rounded-2xl border border-[#eee9e2] dark:border-stone-800 shadow-2xs flex flex-col justify-between overflow-hidden">
          <div className="p-6 pb-2">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <h2 className="font-bold text-base text-stone-900 dark:text-white">
                  Triage Queue
                </h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-400">
                  12
                </span>
              </div>
              <Link
                href="/bugs?status=NEW"
                className="text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline"
              >
                View all
              </Link>
            </div>

            {/* Table Header */}
            <div className="grid grid-cols-12 text-[11px] font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider pb-3 border-b border-stone-100 dark:border-stone-800">
              <div className="col-span-6 sm:col-span-5">Issue</div>
              <div className="col-span-2 text-center">Priority</div>
              <div className="col-span-4 sm:col-span-3">Assignee</div>
              <div className="hidden sm:block sm:col-span-1 text-center">Similarity</div>
              <div className="hidden sm:block sm:col-span-1 text-right">Age</div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-stone-100 dark:divide-stone-800">
              {triageItems.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-12 items-center py-3.5 hover:bg-stone-50/70 dark:hover:bg-stone-800/40 rounded-xl transition-colors px-1"
                >
                  <div className="col-span-6 sm:col-span-5 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline">
                        <Link href={`/bugs/${item.id}`}>{item.code}</Link>
                      </span>
                    </div>
                    <div className="text-xs font-medium text-stone-900 dark:text-white truncate mt-0.5">
                      <Link href={`/bugs/${item.id}`}>{item.title}</Link>
                    </div>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400">
                      {item.component}
                    </span>
                  </div>

                  <div className="col-span-2 text-center">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        item.priority === 'P1'
                          ? 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400'
                          : 'bg-orange-50 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400'
                      }`}
                    >
                      {item.priority}
                    </span>
                  </div>

                  <div className="col-span-4 sm:col-span-3 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-stone-200 dark:bg-stone-700 flex items-center justify-center text-[10px] font-semibold text-stone-600 dark:text-stone-300">
                      {item.assignee ? item.assignee.name.charAt(0) : '?'}
                    </div>
                    <span className="text-xs font-medium text-stone-700 dark:text-stone-300 truncate">
                      {item.assignee ? item.assignee.name : 'Unassigned'}
                    </span>
                  </div>

                  <div className="hidden sm:block sm:col-span-1 text-center">
                    <div className="text-xs font-medium text-stone-700 dark:text-stone-300">
                      {item.similarity}%
                    </div>
                    <div className="w-12 h-1 bg-stone-100 dark:bg-stone-800 rounded-full mx-auto mt-1 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${item.similarity}%` }}
                      />
                    </div>
                  </div>

                  <div className="hidden sm:block sm:col-span-1 text-right text-xs text-stone-400 dark:text-stone-500">
                    {item.age}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 bg-stone-50/50 dark:bg-stone-800/30 border-t border-stone-100 dark:border-stone-800 text-center">
            <Link
              href="/bugs?status=NEW"
              className="text-xs font-semibold text-orange-600 dark:text-orange-400 hover:text-orange-700 inline-flex items-center gap-1"
            >
              View full triage queue →
            </Link>
          </div>
        </div>

        {/* Right Column: Project Health & Recent Activity */}
        <div className="space-y-6">
          {/* Project Health Card */}
          <div className="bg-white dark:bg-stone-900 rounded-2xl p-6 border border-[#eee9e2] dark:border-stone-800 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-base text-stone-900 dark:text-white">
                Project Health
              </h2>
              <button className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200">
                <MoreVerticalIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between gap-4">
              {/* Donut Chart */}
              <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  {/* Background Circle */}
                  <path
                    className="text-stone-100 dark:text-stone-800"
                    strokeWidth="3.8"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  {/* Healthy (72%) */}
                  <path
                    className="text-emerald-500"
                    strokeDasharray="72, 100"
                    strokeWidth="3.8"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  {/* At Risk (18%) */}
                  <path
                    className="text-amber-400"
                    strokeDasharray="18, 100"
                    strokeDashoffset="-72"
                    strokeWidth="3.8"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  {/* Critical (7%) */}
                  <path
                    className="text-red-500"
                    strokeDasharray="7, 100"
                    strokeDashoffset="-90"
                    strokeWidth="3.8"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-base font-bold text-stone-900 dark:text-white leading-none">
                    72%
                  </span>
                  <span className="text-[10px] text-stone-400 font-medium mt-0.5">
                    Healthy
                  </span>
                </div>
              </div>

              {/* Donut Legend */}
              <div className="space-y-2 text-xs flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-stone-600 dark:text-stone-300">Healthy</span>
                  </div>
                  <span className="font-semibold text-stone-900 dark:text-white">72%</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="text-stone-600 dark:text-stone-300">At Risk</span>
                  </div>
                  <span className="font-semibold text-stone-900 dark:text-white">18%</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-stone-600 dark:text-stone-300">Critical</span>
                  </div>
                  <span className="font-semibold text-stone-900 dark:text-white">7%</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-stone-300 dark:bg-stone-600" />
                    <span className="text-stone-600 dark:text-stone-300">Unknown</span>
                  </div>
                  <span className="font-semibold text-stone-900 dark:text-white">3%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity Card */}
          <div className="bg-white dark:bg-stone-900 rounded-2xl p-6 border border-[#eee9e2] dark:border-stone-800 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-base text-stone-900 dark:text-white">
                Recent Activity
              </h2>
              <Link
                href="/activity"
                className="text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline"
              >
                View all
              </Link>
            </div>

            <div className="space-y-3.5">
              {recentActivities.map((act) => (
                <div key={act.id} className="flex items-start gap-2.5 text-xs">
                  <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${act.dotColor}`} />
                  <div className="flex-1">
                    <p className="text-stone-700 dark:text-stone-300">
                      <span className="font-semibold text-stone-900 dark:text-white">
                        {act.actor}
                      </span>{' '}
                      {act.action}{' '}
                      <span className="font-semibold text-stone-900 dark:text-white">
                        {act.target}
                      </span>
                    </p>
                  </div>
                  <span className="text-[11px] text-stone-400 whitespace-nowrap">
                    {act.timeAgo}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom 3 Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Component Health */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl p-6 border border-[#eee9e2] dark:border-stone-800 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-sm text-stone-900 dark:text-white">
              Component Health
            </h2>
            <Link
              href="/components"
              className="text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="space-y-4">
            {componentHealthList.map((comp) => (
              <div key={comp.name} className="flex items-center justify-between gap-3">
                <div className="w-24 text-xs font-medium text-stone-700 dark:text-stone-300 truncate">
                  {comp.name}
                </div>
                <div className="flex-1 h-2 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${comp.color}`}
                    style={{ width: `${comp.percentage}%` }}
                  />
                </div>
                <div className="text-[11px] text-stone-400 whitespace-nowrap w-16 text-right">
                  {comp.issues} issues
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    comp.riskLevel === 'High'
                      ? 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400'
                      : comp.riskLevel === 'Medium'
                      ? 'bg-orange-50 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400'
                      : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                  }`}
                >
                  {comp.riskLevel}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Stale Issues */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl p-6 border border-[#eee9e2] dark:border-stone-800 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-sm text-stone-900 dark:text-white">
              Stale Issues
            </h2>
            <Link
              href="/bugs?sort=stale"
              className="text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="space-y-3.5">
            {staleIssues.map((item) => (
              <div key={item.code} className="flex items-start justify-between gap-3 text-xs">
                <div>
                  <div className="font-bold text-orange-600 dark:text-orange-400 hover:underline">
                    <Link href={`/bugs/${item.code}`}>{item.code}</Link>
                  </div>
                  <div className="text-stone-700 dark:text-stone-300 truncate mt-0.5">
                    {item.title}
                  </div>
                </div>
                <span className="text-stone-400 dark:text-stone-500 whitespace-nowrap text-[11px] mt-0.5">
                  {item.days}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Assignees */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl p-6 border border-[#eee9e2] dark:border-stone-800 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-sm text-stone-900 dark:text-white">
              Top Assignees
            </h2>
            <Link
              href="/teams"
              className="text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="space-y-3.5">
            {topAssignees.map((a) => (
              <div key={a.name} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 w-28 truncate">
                  <div className="w-5 h-5 rounded-full bg-stone-700 text-white flex items-center justify-center text-[9px] font-bold shrink-0">
                    {a.name.charAt(0)}
                  </div>
                  <span className="text-xs font-medium text-stone-800 dark:text-stone-200 truncate">
                    {a.name}
                  </span>
                </div>
                <span className="text-[11px] text-stone-400 whitespace-nowrap">
                  {a.issues} issues
                </span>
                <div className="flex-1 h-1.5 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${a.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}