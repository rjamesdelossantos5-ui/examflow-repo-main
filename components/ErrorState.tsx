'use client'

import Link from 'next/link'
import { Icon } from '@/components/Icon'

/**
 * Shared fallback UI for the route-level error boundaries (app/**\/error.tsx).
 *
 * A failed query used to white-screen the whole page. This keeps the failure
 * contained: the surrounding layout (top nav, role tabs) still renders, and the
 * user gets a plain-language explanation plus a way out — "Try again" re-runs
 * the failed render, which is usually all a transient Supabase/network blip
 * needs. Uses the theme tokens (ef-card / --sti-gold) so it looks right in both
 * light and dark mode.
 */
export default function ErrorState({
  // Defaults stay specific about what the user can do and what wasn't lost —
  // a bare "Something went wrong" leaves them unsure whether their data saved.
  title = "This page didn't load",
  message = 'The connection dropped while loading. Nothing you submitted was lost — please try again.',
  digest,
  onRetry,
  homeHref,
}: {
  title?: string
  message?: string
  /** Server-side error id — shown small so a user can quote it when reporting. */
  digest?: string
  onRetry: () => void
  /** Where "Go back" leads; omitted for the global boundary. */
  homeHref?: string
}) {
  return (
    <div className="ef-card rounded-2xl shadow-sm px-6 py-12 text-center max-w-lg mx-auto">
      <div
        className="mx-auto mb-4 w-14 h-14 rounded-full grid place-items-center"
        style={{ background: 'color-mix(in srgb, #dc2626 14%, transparent)', color: '#dc2626' }}
      >
        <Icon name="x-circle" className="w-7 h-7" />
      </div>

      <h2 className="text-lg font-bold" style={{ color: 'var(--card-foreground)' }}>{title}</h2>
      <p className="text-sm ef-muted mt-1.5">{message}</p>

      <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
        <button
          type="button"
          onClick={onRetry}
          className="px-5 py-2.5 rounded-lg font-semibold text-sm shadow-sm hover:opacity-90 active:scale-[0.98] transition-[opacity,scale] duration-160 ease-[var(--ease-out)]"
          style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
        >
          Try again
        </button>
        {homeHref && (
          <Link
            href={homeHref}
            className="px-5 py-2.5 rounded-lg font-semibold text-sm border ef-border hover:bg-black/[0.03] dark:hover:bg-white/[0.05] active:scale-[0.98] transition-[background-color,scale] duration-160 ease-[var(--ease-out)]"
            style={{ color: 'var(--card-foreground)' }}
          >
            Go back
          </Link>
        )}
      </div>

      {/* Support handle: lets a user quote an id that matches the server logs. */}
      {digest && <p className="mt-5 text-2xs ef-muted">Reference code: {digest}</p>}
    </div>
  )
}
