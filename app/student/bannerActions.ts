'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

const COOKIE = 'ef_banner_dismissed'
const MODAL_COOKIE = 'ef_modal_seen'

// Dismissing just hides the banner for the rest of this login session — the
// cookie is cleared on every fresh sign-in (see app/login/actions.ts), so it
// always comes back next time the student logs in.
export async function dismissBanner() {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE, '1', { path: '/', sameSite: 'lax' })
}

// The one-time "welcome back" popup shown right after login. Clicking OK only
// closes the popup — the dashboard banner stays put and is dismissed (via its
// own X) separately. Also cleared on every fresh sign-in.
export async function dismissModal() {
  const cookieStore = await cookies()
  cookieStore.set(MODAL_COOKIE, '1', { path: '/', sameSite: 'lax' })
}

// Acknowledges a specific exam-schedule announcement (identified by a
// "<periodId>:<scheduleUpdatedAt>" signature) so the one-time popup for it
// doesn't come back. Unlike dismissBanner/dismissModal, this is NOT reset on
// login — it's meant to stay acknowledged until the schedule actually
// changes again (a new signature), which is why it's a DB column, not a
// cookie.
export async function ackSchedule(signature: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('profiles').update({ schedule_ack: signature }).eq('id', user.id)
}
