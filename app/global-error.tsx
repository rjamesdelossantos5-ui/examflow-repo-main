'use client'

/**
 * Last-resort boundary: catches errors thrown by the ROOT layout itself, which
 * app/error.tsx can't reach. It replaces the root layout entirely, so it must
 * render its own <html>/<body>.
 *
 * Styles are deliberately inline rather than Tailwind/theme classes — if the
 * root layout failed, the stylesheet or font may not have loaded either, and a
 * fallback that depends on them could render as unreadable plain text.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#f3f4f6', fontFamily: 'system-ui, -apple-system, Segoe UI, Arial, sans-serif' }}>
        <title>EXAMFLOW — Something went wrong</title>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: '3rem 1.5rem', textAlign: 'center', maxWidth: 480, width: '100%' }}>
            <div style={{ fontWeight: 800, letterSpacing: '-0.02em', color: '#002F6C', marginBottom: 20 }}>
              EXAM<span style={{ color: '#FDB913' }}>FLOW</span>
            </div>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#1f2937', margin: 0 }}>
              Something went wrong
            </h2>
            <p style={{ fontSize: '0.9375rem', color: '#6b7280', marginTop: 8, marginBottom: 24 }}>
              The page couldn&apos;t load. This is usually temporary — please try again.
            </p>
            <button
              type="button"
              onClick={() => unstable_retry()}
              style={{ background: '#FDB913', color: '#002F6C', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 600, fontSize: '0.9375rem', cursor: 'pointer' }}
            >
              Try again
            </button>
            {error.digest && (
              <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 20, marginBottom: 0 }}>
                Reference code: {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  )
}
