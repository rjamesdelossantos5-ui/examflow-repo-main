'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { markRequestsViewed } from '@/app/requestViewActions'

/**
 * Renders nothing. While mounted with request ids, records that the person has
 * opened them and refreshes the page data so the header bell drops them from
 * its count. Re-runs only when the set of ids changes.
 */
export default function MarkViewed({ ids }: { ids: string[] }) {
  const router = useRouter()
  const key = ids.join(',')

  useEffect(() => {
    if (!key) return
    let cancelled = false
    markRequestsViewed(key.split(',')).then((res) => {
      if (!cancelled && !res.error) router.refresh()
    })
    return () => { cancelled = true }
  }, [key, router])

  return null
}
