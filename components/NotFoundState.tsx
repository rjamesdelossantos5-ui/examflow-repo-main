import Link from 'next/link'
import { Icon } from '@/components/Icon'

/**
 * Shared fallback UI for the route-level not-found boundaries
 * (app/**\/not-found.tsx), and the sibling of ErrorState.
 *
 * Without a not-found.tsx anywhere in the app, notFound() fell through to
 * Next.js's built-in 404 — a bare unstyled "This page could not be found" with
 * no header, no nav, and no link back, which is what testers hit after deleting
 * a request and pressing Back. This keeps the surrounding layout intact and
 * always gives the user a way out.
 *
 * A missing record is normal (deleted, withdrawn, or auto-purged after the
 * exam), not a crash — so the tone is matter-of-fact and there is no "Try
 * again" button: retrying a deleted row can never succeed.
 */
export default function NotFoundState({
  title = 'Page not found',
  message = "This page doesn't exist, or the link you followed is out of date.",
  homeHref = '/',
  homeLabel = 'Go to homepage',
}: {
  title?: string
  message?: string
  homeHref?: string
  homeLabel?: string
}) {
  return (
    <div className="ef-card rounded-2xl shadow-sm px-6 py-12 text-center max-w-lg mx-auto">
      <div
        className="mx-auto mb-4 w-14 h-14 rounded-full grid place-items-center"
        style={{ background: 'color-mix(in srgb, var(--sti-gold) 16%, transparent)', color: 'var(--sti-gold)' }}
      >
        <Icon name="file" className="w-7 h-7" />
      </div>

      <h2 className="text-lg font-bold" style={{ color: 'var(--card-foreground)' }}>{title}</h2>
      <p className="text-sm ef-muted mt-1.5">{message}</p>

      <div className="mt-6 flex justify-center">
        <Link
          href={homeHref}
          className="ef-press px-5 py-2.5 rounded-lg font-semibold text-sm shadow-sm hover:opacity-90 transition-opacity duration-200 ease-[var(--ease-out)]"
          style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
        >
          {homeLabel}
        </Link>
      </div>
    </div>
  )
}
