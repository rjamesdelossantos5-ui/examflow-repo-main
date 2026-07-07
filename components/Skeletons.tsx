// Lightweight loading skeletons shown by each route's loading.tsx while the
// server renders the real page. They mirror the list/queue layouts so the jump
// from skeleton to content is minimal — this is what makes tab switches feel
// instant on a phone instead of showing a blank frozen screen.

function Bar({ className = '' }: { className?: string }) {
  return <div className={`rounded bg-black/[0.06] dark:bg-white/[0.09] ${className}`} />
}

// A page heading placeholder (title + subtitle).
export function HeaderSkeleton() {
  return (
    <div className="space-y-2">
      <Bar className="h-6 w-48" />
      <Bar className="h-3.5 w-64" />
    </div>
  )
}

// A stack of card rows that matches the request/queue list items.
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2.5" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="ef-card flex items-center gap-4 rounded-xl shadow-sm p-4">
          <Bar className="w-11 h-11 rounded-lg shrink-0" />
          <div className="min-w-0 flex-1 space-y-2">
            <Bar className="h-4 w-1/2" />
            <Bar className="h-3 w-2/3" />
          </div>
          <Bar className="h-6 w-16 rounded-full shrink-0" />
        </div>
      ))}
    </div>
  )
}

// Header + list — the default full-page loading state.
export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-6 animate-pulse">
      <HeaderSkeleton />
      <ListSkeleton rows={rows} />
    </div>
  )
}
