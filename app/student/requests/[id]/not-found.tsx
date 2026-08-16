import NotFoundState from '@/components/NotFoundState'

export const metadata = { title: 'EXAMFLOW — Request Not Found' }

/**
 * Shown when page.tsx calls notFound() because the request row is gone. Nested
 * here, so it renders INSIDE the student DashboardLayout — the header and nav
 * stay, and the student is one tap from their list instead of stranded on a
 * blank 404.
 *
 * Reached whenever a request no longer exists: the student withdrew or deleted
 * it and pressed Back, a Program Head deleted it while the page was open (the
 * layout's LiveRefresh re-renders on realtime events and on tab focus), or
 * purgeExpiredExams removed it a day after the exam.
 */
export default function RequestNotFound() {
  return (
    <NotFoundState
      title="This request is no longer available"
      message="It was withdrawn, deleted, or removed after its exam date had passed. Any other requests you filed are still in your list."
      homeHref="/student"
      homeLabel="Back to My Requests"
    />
  )
}
