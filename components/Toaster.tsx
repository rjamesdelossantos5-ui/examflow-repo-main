'use client'

import { useEffect, useSyncExternalStore } from 'react'

/**
 * Pop-ups, bottom-right, gone after a few seconds: red for an error, green for
 * something that worked.
 *
 * Most screens already show an error as a banner at the top of the page, which a
 * user scrolled down a long form (or looking at a modal) never sees. This shows
 * the same message where they are looking. The banners stay; this is added on top.
 *
 * Mounted once in DashboardLayout. Call toastError / toastSuccess from an event
 * handler, or useErrorToast / useSuccessToast next to a state so every change of
 * it pops up. <ErrorToast /> and <SuccessToast /> do the same for server pages.
 * The store lives outside React, so a toast fired just before a client-side
 * navigation is still shown on the next page (the Toaster is in the layout).
 */

const SHOW_MS = 5000
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

function push(kind: Kind, message: string) {
  // The same message already on screen (dev double-effects, a repeated click)
  // is not shown twice.
  if (!message || toasts.some((t) => t.message === message && t.kind === kind)) return
  const id = nextId++
  toasts = [...toasts, { id, message, kind }].slice(-MAX_VISIBLE)
  emit()
  setTimeout(() => dismiss(id), SHOW_MS)
}

export function toastError(message: string) {
  push('error', message)
}

export function toastSuccess(message: string) {
  push('success', message)
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

export function useSuccessToast(message: string | null | undefined) {
  useEffect(() => {
    if (message) toastSuccess(message)
  }, [message])
}

/** For server components, which can't call the hooks themselves. */
export function ErrorToast({ message }: { message?: string | null }) {
  useErrorToast(message)
  return null
}

/**
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

const ACCENT: Record<Kind, string> = {
  error: 'var(--status-danger)',
  success: '#16a34a',
}

export default function Toaster() {
  const items = useSyncExternalStore(subscribe, () => toasts, () => EMPTY)
  if (items.length === 0) return null

  return (
    <div
      className="fixed z-[200] right-4 bottom-4 flex flex-col gap-2 w-[calc(100vw-2rem)] max-w-sm pointer-events-none"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {items.map((t) => (
        <div
          key={t.id}
          role={t.kind === 'error' ? 'alert' : 'status'}
          className="ef-toast pointer-events-auto flex items-start gap-3 rounded-lg px-4 py-3 text-sm shadow-lg border"
          style={{
            background: 'var(--card)',
            color: 'var(--card-foreground)',
            borderColor: 'var(--border)',
            borderLeft: `4px solid ${ACCENT[t.kind]}`,
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
