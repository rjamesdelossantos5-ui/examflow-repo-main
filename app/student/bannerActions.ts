'use server'

import { cookies } from 'next/headers'

const COOKIE = 'ef_banner_dismissed'

// Dismissing just hides the banner for the rest of this login session — the
// cookie is cleared on every fresh sign-in (see app/login/actions.ts), so it
// always comes back next time the student logs in.
export async function dismissBanner() {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE, '1', { path: '/', sameSite: 'lax' })
}
