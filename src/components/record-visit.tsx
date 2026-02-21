'use client'

import { useEffect } from 'react'

/**
 * Records a unique daily visit when the app loads. Runs once per mount (layout).
 * Uses a cookie so the same visitor counts once per day.
 */
export default function RecordVisit() {
  useEffect(() => {
    fetch('/api/record-visit', { method: 'POST', credentials: 'include' }).catch(() => {})
  }, [])
  return null
}
