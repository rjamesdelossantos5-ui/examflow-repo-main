'use client'

import { useState } from 'react'

const SIZES = [10, 25, 50, 100]

interface PagerProps {
  page: number
  pages: number
  total: number
  size: number
  onPage: (page: number) => void
  onSize: (size: number) => void
}

/**
 * Splits an already-filtered list into pages. `resetKey` should change whenever
 * the search or a filter does (e.g. `${query}|${role}`): the table then goes back
 * to page 1 instead of staying on a page that may no longer exist. The page is
 * also kept within range if the list shrinks (a row deleted, a stricter filter).
 */
export function usePagination<T>(items: T[], resetKey: string, initialSize = 25) {
  const [state, setState] = useState({ page: 1, key: resetKey, size: initialSize })
  const size = state.size
  const pages = Math.max(1, Math.ceil(items.length / size))
  const page = Math.min(state.key === resetKey ? state.page : 1, pages)

  const pagerProps: PagerProps = {
    page,
    pages,
    total: items.length,
    size,
    onPage: (p) => setState((s) => ({ ...s, page: p, key: resetKey })),
    onSize: (n) => setState({ page: 1, key: resetKey, size: n }),
  }
  return { items: items.slice((page - 1) * size, page * size), pagerProps }
}

/** Page controls under a table. Hidden when everything fits on the smallest page. */
export default function Pagination({ page, pages, total, size, onPage, onSize }: PagerProps) {
  if (total <= SIZES[0]) return null

  const from = (page - 1) * size + 1
  const to = Math.min(page * size, total)
  const btn =
    'px-4 py-2 md:px-5 md:py-2.5 rounded-lg border ef-border text-sm md:text-base font-semibold transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed'

  // Centred under the table: the count on one line, the controls on the next.
  return (
    <nav aria-label="Pagination" className="mt-5 flex flex-col items-center gap-3 text-center text-sm md:text-base ef-muted">
      <span className="tabular-nums">Showing {from}–{to} of {total}</span>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <label className="flex items-center gap-2">
          Rows per page
          <select
            value={size}
            onChange={(e) => onSize(Number(e.target.value))}
            className="rounded-lg border ef-border px-3 py-2 md:py-2.5 text-sm md:text-base cursor-pointer"
            style={{ backgroundColor: 'var(--card)', color: 'var(--card-foreground)' }}
          >
            {SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <button type="button" className={btn} style={{ color: 'var(--card-foreground)' }} disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </button>
        <span className="tabular-nums">Page {page} of {pages}</span>
        <button type="button" className={btn} style={{ color: 'var(--card-foreground)' }} disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </button>
      </div>
    </nav>
  )
}
