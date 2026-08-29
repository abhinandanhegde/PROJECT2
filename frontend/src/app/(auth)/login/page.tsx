'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signIn, signUp } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { BugIcon } from '@/components/ui/Icons'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Redirect if already logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/')
    })
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: signInError } = await signIn(email, password)

    setLoading(false)
    if (signInError) {
      setError(signInError.message)
      return
    }
    router.push('/')
  }

  async function handleDemoLogin() {
    setError('')
    setLoading(true)

    // Create a demo account on the fly, then sign in
    const demoEmail = `demo-${Date.now()}@bugflow.demo`
    const demoPassword = 'DemoPass123!'
    const demoName = 'Demo User'

    const { error: signUpError } = await signUp(demoEmail, demoPassword, demoName)
    if (signUpError) {
      // If signup fails, try signing in with existing demo
      const { error: signInError } = await signIn(demoEmail, demoPassword)
      setLoading(false)
      if (signInError) {
        setError('Demo account setup failed. Please sign up manually.')
        return
      }
    }

    // Sign in with the demo account
    const { error: signInError } = await signIn(demoEmail, demoPassword)
    setLoading(false)
    if (signInError) {
      setError(signInError.message)
      return
    }
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-[#f8f6f3] dark:bg-[#121110] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 mb-4">
          <BugIcon className="w-7 h-7 text-orange-600" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-white">
          Sign in to BugFlow
        </h2>
        <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
          Track • Triage • Resolve software bugs in real-time
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white dark:bg-stone-900 py-8 px-6 shadow-xl shadow-stone-200/50 dark:shadow-none sm:rounded-2xl sm:px-10 border border-[#eee9e2] dark:border-stone-800">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                Email address
              </label>
              <input
                type="email"
                placeholder="alex@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800 text-stone-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800 text-stone-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 rounded-xl bg-[#ea580c] hover:bg-[#c2410c] text-white font-semibold text-sm shadow-md shadow-orange-500/20 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6">
            {/* Demo Account Button */}
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl border-2 border-dashed border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-400 font-semibold text-xs hover:border-orange-400 hover:text-orange-600 dark:hover:border-orange-500 dark:hover:text-orange-400 transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Setting up demo...' : '⚡ Try Demo Account — No signup needed'}
            </button>

            <div className="mt-4 text-center text-xs text-stone-500 dark:text-stone-400">
              Don&apos;t have an account?{' '}
              <Link
                href="/signup"
                className="font-semibold text-orange-600 hover:text-orange-500"
              >
                Sign up
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}