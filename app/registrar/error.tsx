'use client'

import ErrorState from '@/components/ErrorState'

export default function RegistrarError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return (
    <ErrorState
      title="We couldn't load the queue"
      message="This is usually a temporary connection problem. Please try again — no submissions were lost."
      digest={error.digest}
      onRetry={unstable_retry}
      homeHref="/registrar"
    />
  )
}
