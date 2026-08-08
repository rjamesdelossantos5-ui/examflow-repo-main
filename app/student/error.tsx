'use client'

import ErrorState from '@/components/ErrorState'

// Keeps the student nav/header intact and contains the failure to the page body.
export default function StudentError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return (
    <ErrorState
      title="We couldn't load your requests"
      message="This is usually a temporary connection problem. Please try again — your submitted requests are safe."
      digest={error.digest}
      onRetry={unstable_retry}
      homeHref="/student"
    />
  )
}
