'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastItem {
  id: string
  type: ToastType
  message: string
  description?: string
}

interface ToastContextValue {
  toast: (item: Omit<ToastItem, 'id'>) => void
  success: (message: string, description?: string) => void
  error: (message: string, description?: string) => void
  info: (message: string, description?: string) => void
  warning: (message: string, description?: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback(
    ({ type, message, description }: Omit<ToastItem, 'id'>) => {
      const id = Math.random().toString(36).substring(2, 9)
      const newToast: ToastItem = { id, type, message, description }
      setToasts((prev) => [...prev, newToast])

      setTimeout(() => {
        removeToast(id)
      }, 4500)
    },
    [removeToast]
  )

  const success = useCallback(
    (message: string, description?: string) =>
      addToast({ type: 'success', message, description }),
    [addToast]
  )

  const error = useCallback(
    (message: string, description?: string) =>
      addToast({ type: 'error', message, description }),
    [addToast]
  )

  const info = useCallback(
    (message: string, description?: string) =>
      addToast({ type: 'info', message, description }),
    [addToast]
  )

  const warning = useCallback(
    (message: string, description?: string) =>
      addToast({ type: 'warning', message, description }),
    [addToast]
  )

  return (
    <ToastContext.Provider value={{ toast: addToast, success, error, info, warning }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-xl p-4 shadow-lg border backdrop-blur-sm transition-all duration-200 transform translate-y-0 ${
              t.type === 'success'
                ? 'bg-emerald-50/95 border-emerald-200 text-emerald-900 dark:bg-emerald-950/90 dark:border-emerald-800 dark:text-emerald-200'
                : t.type === 'error'
                ? 'bg-red-50/95 border-red-200 text-red-900 dark:bg-red-950/90 dark:border-red-800 dark:text-red-200'
                : t.type === 'warning'
                ? 'bg-amber-50/95 border-amber-200 text-amber-900 dark:bg-amber-950/90 dark:border-amber-800 dark:text-amber-200'
                : 'bg-stone-50/95 border-stone-200 text-stone-900 dark:bg-stone-900/90 dark:border-stone-700 dark:text-stone-100'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold text-sm">{t.message}</div>
                {t.description && (
                  <div className="text-xs mt-1 opacity-80">{t.description}</div>
                )}
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="text-xs opacity-60 hover:opacity-100 cursor-pointer p-0.5"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
