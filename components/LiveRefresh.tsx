'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// How often the polling fallback re-checks (ms). Light enough for cheap phones
// — one server refetch, no payload if nothing changed.
const POLL_MS = 20000

/**
 * Keeps the dashboard (notification bell + queues) up to date without a manual
 * reload, using three triggers so it's reliable everywhere:
 *   1. Supabase Realtime — instant when the table is in the realtime publication.
 *   2. A 20s polling fallback — works even if Realtime isn't configured.
 *   3. Refresh when the tab regains focus — instant when you switch back.
 * Each just calls router.refresh(), which re-runs the server components that
 * compute notifications.
 */
export default function LiveRefresh() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    // 1. Realtime (instant)
    const channel = supabase
      .channel('examflow-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'special_exam_requests' }, () => {
        router.refresh()
      })
      .subscribe()

    // 2. Polling fallback
    const interval = setInterval(() => router.refresh(), POLL_MS)

    // 3. Refresh when the tab becomes visible / focused again
    const onVisible = () => { if (document.visibilityState === 'visible') router.refresh() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [router])

  return null
}
