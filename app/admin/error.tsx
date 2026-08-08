'use client'

import ErrorState from '@/components/ErrorState'

export default function AdminError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return (
    <ErrorState
      title="We couldn't load this page"
      message="This is usually a temporary connection problem. Please try again — no records were changed."
      digest={error.digest}
      onRetry={unstable_retry}
      homeHref="/admin/users"
    />
  )
}
