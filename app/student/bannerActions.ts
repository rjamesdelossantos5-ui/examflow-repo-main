'use server'

import { cookies } from 'next/headers'

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
