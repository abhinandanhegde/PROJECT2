import React from 'react'

type BadgeVariant = 'status' | 'severity' | 'priority' | 'default'

const STATUS_STYLES: Record<string, string> = {
  NEW: 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300',
  CONFIRMED: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  IN_PROGRESS: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
  RESOLVED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  VERIFIED: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300',
  CLOSED: 'bg-stone-200 text-stone-700 dark:bg-stone-700 dark:text-stone-300',
  REOPENED: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
}

const SEVERITY_STYLES: Record<string, string> = {
  BLOCKER: 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-900',
  CRITICAL: 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-900',
  MAJOR: 'bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 border border-orange-200 dark:border-orange-900',
  NORMAL: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-900',
  MINOR: 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
  TRIVIAL: 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
}

const PRIORITY_STYLES: Record<string, string> = {
  P1: 'bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200 font-bold',
  P2: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 font-semibold',
  P3: 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200',
  P4: 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
  P5: 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
}

function getStyle(variant: BadgeVariant, value: string): string {
  switch (variant) {
    case 'status': return STATUS_STYLES[value] || 'bg-stone-100 text-stone-700'
    case 'severity': return SEVERITY_STYLES[value] || 'bg-stone-100 text-stone-700'
    case 'priority': return PRIORITY_STYLES[value] || 'bg-stone-100 text-stone-700'
    default: return 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300'
  }
}

interface BadgeProps {
  variant?: BadgeVariant
  value: string
  className?: string
}

export function Badge({ variant = 'default', value, className = '' }: BadgeProps) {
  const base = variant === 'priority' ? 'px-2 py-0.5 rounded-full text-xs' : 'px-2.5 py-0.5 rounded-md text-xs font-semibold'
  return (
    <span className={`inline-block ${base} ${getStyle(variant, value)} ${className}`}>
      {value.replace(/_/g, ' ')}
    </span>
  )
}
