import NotFoundState from '@/components/NotFoundState'

export const metadata = { title: 'EXAMFLOW — Page Not Found' }

/**
 * App-wide 404. Per the Next.js docs, the ROOT not-found also handles any URL
 * that matches no route at all — so this replaces the framework's bare default
 * page everywhere it isn't covered by a nested not-found.tsx.
 *
 * Renders in the root layout only (there's no dashboard nav here, since an
 * unmatched URL carries no role), so it links to the homepage, which already
 * routes a signed-in user on to their own dashboard.
 */
export default function NotFound() {
  return (
    <main className="min-h-screen grid place-items-center p-6" style={{ background: 'var(--background)' }}>
      <NotFoundState />
    </main>
  )
}
