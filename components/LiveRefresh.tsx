'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Subscribes to request changes and refreshes the server components (which
 * recompute the header notifications + queues) so the bell updates live — no
 * manual reload. One websocket channel that only fires on actual DB changes,
 * so it stays light even on low-end phones (no constant polling).
 */
export default function LiveRefresh() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('examflow-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'special_exam_requests' }, () => {
        router.refresh()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [router])

  return null
}
