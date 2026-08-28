'use client'

import { useEffect, useState } from 'react'
import { getSession } from '@/lib/auth'

export default function DashboardPage() {
  const [token, setToken] = useState('')

  useEffect(() => {
    getSession().then(({ data }) => {
      setToken(data.session?.access_token ?? 'NO SESSION FOUND')
    })
  }, [])

  return (
    <div>
      <p>Dashboard - stats coming soon</p>
      <p className="mt-4 text-xs break-all bg-gray-100 p-2 rounded">
        Token: {token}
      </p>
    </div>
  )
}