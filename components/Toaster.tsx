'use client'

import { useEffect, useSyncExternalStore } from 'react'

/**
 * Error pop-ups, bottom-right, gone after a few seconds.
 *
 * Most screens already show an error as a banner at the top of the page, which a
 * user scrolled down a long form (or looking at a modal) never sees. This shows
 * the same message where they are looking. The banners stay; this is added on top.
 *
 * Mounted once in DashboardLayout. Call toastError(message) from an event
 * handler, or useErrorToast(error) next to an `error` state so every change of
 * that state pops up. <ErrorToast message={...} /> does the same for server pages.
 */

const SHOW_MS = 5000
const MAX_VISIBLE = 3

interface Toast { id: number; message: string }

let toasts: Toast[] = []
let nextId = 1
const listeners = new Set<() => void>()
const EMPTY: Toast[] = []

function emit() {
  listeners.forEach((l) => l())
}

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

export function toastError(message: string) {
  // The same message already on screen (dev double-effects, a repeated click)
  // is not shown twice.
  if (!message || toasts.some((t) => t.message === message)) return
  const id = nextId++
  toasts = [...toasts, { id, message }].slice(-MAX_VISIBLE)
  emit()
  setTimeout(() => dismiss(id), SHOW_MS)
}

/** Pops up whenever `message` changes to a non-empty value. */
export function useErrorToast(message: string | null | undefined) {
  useEffect(() => {
    if (message) toastError(message)
  }, [message])
}

/** For server components, which can't call the hook themselves. */
export function ErrorToast({ message }: { message?: string | null }) {
  useErrorToast(message)
  return null
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => { listeners.delete(l) }
}

export default function Toaster() {
  const items = useSyncExternalStore(subscribe, () => toasts, () => EMPTY)
  if (items.length === 0) return null

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed z-[200] right-4 bottom-4 flex flex-col gap-2 w-[calc(100vw-2rem)] max-w-sm pointer-events-none"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {items.map((t) => (
        <div
          key={t.id}
          className="ef-toast pointer-events-auto flex items-start gap-3 rounded-lg px-4 py-3 text-sm shadow-lg border"
          style={{
            background: 'var(--card)',
            color: 'var(--card-foreground)',
            borderColor: 'var(--border)',
            borderLeft: '4px solid var(--status-danger)',
          }}
        >
          <span className="flex-1 min-w-0 break-words">{t.message}</span>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss"
            className="shrink-0 leading-none text-lg ef-muted hover:opacity-70"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
