'use client'

import { useEffect, useSyncExternalStore } from 'react'

/**
 * Pop-ups, gone after a few seconds (bottom centre on desktop, bottom right on smaller screens): a red icon for errors, a
 * green tick for successes.
 *
 * Most screens already show an error as a banner at the top of the page, which a
 * user scrolled down a long form (or looking at a modal) never sees. This shows
 * the same message where they are looking. The banners stay; this is added on top.
 *
 * Mounted once in DashboardLayout. The store lives outside React, so a toast
 * fired just before a client-side navigation is still shown on the next page.
 *
 * Errors:
 *   toastError(message)            from an event handler
 *   useErrorToast(error)           next to an `error` state; pops up on every change
 *   <ErrorToast message={...} />   for server pages
 *
 * Successes (same three, same behaviour):
 *   toastSuccess(message)
 *   useSuccessToast(message)
 *   <SuccessToast message={...} clearParam="flag" />
 *   withSuccessToast(action, message)   wraps a server action; toasts only if it
 *                                       came back without an error
 */

const ERROR_MS = 5000
const SUCCESS_MS = 4000
const MAX_VISIBLE = 3

type Kind = 'error' | 'success'
interface Toast { id: number; message: string; kind: Kind }

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

function show(kind: Kind, message: string, ms: number) {
  // The same message already on screen (dev double-effects, a repeated click)
  // is not shown twice.
  if (!message || toasts.some((t) => t.message === message && t.kind === kind)) return
  const id = nextId++
  toasts = [...toasts, { id, message, kind }].slice(-MAX_VISIBLE)
  emit()
  setTimeout(() => dismiss(id), ms)
}

export function toastError(message: string) {
  show('error', message, ERROR_MS)
}

export function toastSuccess(message: string) {
  show('success', message, SUCCESS_MS)
}

/**
 * Wraps a server action so a green toast shows only when it came back without
 * an error. The result is returned untouched, so existing error handling at the
 * call site (banner, error toast) is unchanged.
 */
export function withSuccessToast<A extends unknown[], R extends { error?: string | null } | void>(
  action: (...args: A) => Promise<R>,
  message: string | ((result: R) => string),
) {
  return async (...args: A): Promise<R> => {
    const res = await action(...args)
    if (!(res && (res as { error?: string | null }).error)) toastSuccess(typeof message === 'function' ? message(res) : message)
    return res
  }
}

/** Pops up whenever `message` changes to a non-empty value. */
export function useErrorToast(message: string | null | undefined) {
  useEffect(() => {
    if (message) toastError(message)
  }, [message])
}

/** Pops up whenever `message` changes to a non-empty value. */
export function useSuccessToast(message: string | null | undefined) {
  useEffect(() => {
    if (message) toastSuccess(message)
  }, [message])
}

/** For server components, which can't call the hook themselves. */
export function ErrorToast({ message }: { message?: string | null }) {
  useErrorToast(message)
  return null
}

/**
 * For server components, which can't call the hook themselves.
 * `clearParam`: a ?flag in the address that only exists to trigger this toast
 * (set by a server action's redirect). It is removed from the address bar after
 * showing, so reloading the page doesn't pop the message up again.
 */
export function SuccessToast({ message, clearParam }: { message?: string | null; clearParam?: string }) {
  useSuccessToast(message)
  useEffect(() => {
    if (!message || !clearParam) return
    const url = new URL(window.location.href)
    if (!url.searchParams.has(clearParam)) return
    url.searchParams.delete(clearParam)
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
  }, [message, clearParam])
  return null
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => { listeners.delete(l) }
}

export default function Toaster() {
  const items = useSyncExternalStore(subscribe, () => toasts, () => EMPTY)
  if (items.length === 0) return null

  // Plain and small: the app's card surface, a hairline border, one small
  // coloured icon for the kind, the message, and a close button. Bottom right on
  // phones, bottom centre on desktop; each toast is only as wide as its text.
  return (
    <div
      className="fixed z-[200] right-4 bottom-4 left-4 lg:left-1/2 lg:right-auto lg:bottom-8 lg:-translate-x-1/2 flex flex-col items-end lg:items-center gap-2 pointer-events-none"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {items.map((t) => {
        const success = t.kind === 'success'
        const tone = success ? 'var(--status-success, #16a34a)' : 'var(--status-danger)'
        return (
          <div
            key={t.id}
            role={success ? 'status' : 'alert'}
            aria-live={success ? 'polite' : 'assertive'}
            className="ef-toast pointer-events-auto flex items-start gap-2.5 w-fit max-w-[min(24rem,calc(100vw-2rem))] rounded-lg border pl-3 pr-1.5 py-2 text-sm"
            style={{
              background: 'var(--card)',
              color: 'var(--card-foreground)',
              borderColor: 'var(--border)',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.08)',
            }}
          >
            <svg
              viewBox="0 0 16 16"
              className="w-4 h-4 shrink-0 mt-0.5"
              fill="none"
              stroke={tone}
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              {success ? (
                <path d="M3.5 8.5l3 3 6-7" />
              ) : (
                <>
                  <circle cx="8" cy="8" r="6.25" />
                  <path d="M8 4.75v3.75M8 11.1v.15" />
                </>
              )}
            </svg>
            <span className="flex-1 min-w-0 break-words leading-snug">{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="shrink-0 grid place-items-center w-5 h-5 rounded ef-muted hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
            >
              <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>
        )
      })}
    </div>
  )
}
