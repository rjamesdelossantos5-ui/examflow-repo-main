'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Fallback poll interval (ms). Only used when Realtime isn't connected, so it's
// slow — Realtime (when configured) handles instant updates for free.
const POLL_MS = 60000

/**
 * Keeps the dashboard up to date without a manual reload:
 *   1. Supabase Realtime — instant when the table is in the realtime publication.
 *   2. A 60s fallback poll that ONLY fires when Realtime isn't connected, so
 *      when Realtime works there's no background query load at all.
 *   3. Refresh when the tab regains focus — instant when you switch back.
 */
export default function LiveRefresh() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    let realtimeOk = false

    const channel = supabase
      .channel('examflow-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'special_exam_requests' }, () => {
        router.refresh()
      })
      .subscribe((status) => { realtimeOk = status === 'SUBSCRIBED' })

    // Fallback only — skips the refetch entirely while Realtime is connected.
    const interval = setInterval(() => { if (!realtimeOk) router.refresh() }, POLL_MS)

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
