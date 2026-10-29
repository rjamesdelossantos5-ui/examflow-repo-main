'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// How often the page reloads its data while Realtime is NOT connected (the
// migration has not been run, or the connection dropped).
const FALLBACK_POLL_MS = 15000

/**
 * Keeps the User Activity page live. Renders only a small status pill.
 *
 * Every step of a request writes a row to progress_logs. This listens for new
 * rows (Supabase Realtime, see supabase/migration_realtime_progress_logs.sql) and
 * reloads the page's data a moment later, so a student's submit, a teacher's
 * approval or a receipt upload shows up here as it happens, with no refresh.
 * While Realtime is not connected it falls back to reloading every 15 seconds.
 */
export default function LiveActivity() {
  const router = useRouter()
  const [live, setLive] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let connected = false
    let timer: ReturnType<typeof setTimeout> | null = null

    // Several rows in a burst (a bulk approval writes one per request) cause one reload.
    const refresh = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => router.refresh(), 400)
    }

    const channel = supabase
      .channel('admin-user-activity')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'progress_logs' }, refresh)
      .subscribe((status) => {
        connected = status === 'SUBSCRIBED'
        setLive(connected)
      })

    const poll = setInterval(() => { if (!connected) router.refresh() }, FALLBACK_POLL_MS)

    return () => {
      if (timer) clearTimeout(timer)
      clearInterval(poll)
      supabase.removeChannel(channel)
    }
  }, [router])

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border ef-border"
      style={{ color: 'var(--card-foreground)' }}
      title={live ? 'New activity appears here as it happens.' : 'Not connected to live updates; reloading every 15 seconds.'}
      role="status"
    >
      <span
        aria-hidden
        className="w-2 h-2 rounded-full"
        style={{ background: live ? 'var(--status-success, #16a34a)' : 'var(--muted, #9ca3af)' }}
      />
      {live ? 'Live' : 'Updating every 15 s'}
    </span>
  )
}
