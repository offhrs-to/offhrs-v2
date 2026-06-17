'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminFetch } from '@/lib/admin-fetch'

/** Redirect to /admin when the admin session cookie is missing or expired. */
export function useRequireAdminSession() {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    adminFetch('/api/admin/session')
      .then((res) => {
        if (cancelled) return
        if (!res.ok) {
          router.replace('/admin')
          return
        }
        setReady(true)
      })
      .catch(() => {
        if (!cancelled) router.replace('/admin')
      })
    return () => {
      cancelled = true
    }
  }, [router])

  return ready
}
