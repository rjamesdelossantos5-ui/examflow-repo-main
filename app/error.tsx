'use client'

import ErrorState from '@/components/ErrorState'

// App-wide fallback for any route without its own error.tsx (login, account,
// the landing page). Role dashboards have their own so their nav survives.
export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--background)' }}>
      <ErrorState
        digest={error.digest}
        onRetry={unstable_retry}
        homeHref="/"
      />
    </div>
  )
}
