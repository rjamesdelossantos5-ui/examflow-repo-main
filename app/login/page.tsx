import { redirect } from 'next/navigation'

export const metadata = { title: 'EXAMFLOW — Login' }

/**
 * There is no separate login page: signing in happens in the landing page's
 * popup (app/LoginModal.tsx). /login is kept only as a redirect, because the
 * proxy, every role layout and the Microsoft callback still send people here
 * (with ?error=… when something went wrong). `?login=1` opens the popup and
 * the error is shown inside it.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  redirect(error ? `/?login=1&error=${encodeURIComponent(error)}` : '/?login=1')
}
