'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Icon, type IconName } from './Icon'
import { markNotificationsSeen } from '@/app/notificationActions'

export type NotificationTone = 'info' | 'success' | 'warning' | 'danger'

export interface NotificationItem {
  id: string
  text: string
  href: string
  tone?: NotificationTone
  icon?: IconName
  /**
   * Students only: true = changed since the bell was last opened (highlighted,
   * counted on the badge); false = already seen, but still listed. Left out for
   * staff, whose items are pending work and always count.
   */
  unread?: boolean
}

const keyOf = (n: NotificationItem) => `${n.id}|${n.text}`

// Tone → accent color used by the per-item icon chip (tinted bg + solid icon).
const TONE: Record<NotificationTone, string> = {
  info: '#3b82f6',
  success: '#16a34a',
  warning: '#f59e0b',
  danger: '#dc2626',
}

/**
 * Header bell for every role. Each item carries a tone + icon so the dropdown
 * reads as a real notification feed (colored chips per event type) rather than
 * a flat text list. Height is capped + scrolls so it never floods the screen.
 */
export default function NotificationBell({ items = [] }: { items?: NotificationItem[] }) {
  const [open, setOpen] = useState(false)
  // Unread items already opened in this visit — hides the badge at once,
  // before the server's copy catches up.
  const [seenKeys, setSeenKeys] = useState<Set<string>>(() => new Set())
  const pending = useRef<Promise<void> | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const count = items.filter((n) => n.unread === undefined || (n.unread && !seenKeys.has(keyOf(n)))).length
  const newInList = items.filter((n) => n.unread !== false).length

  // The list is only reloaded after the dropdown closes, so what the person is
  // reading never disappears under them (it used to refresh ~a second after
  // opening and empty the list).
  const close = useCallback(() => {
    setOpen(false)
    const p = pending.current
    if (p) {
      pending.current = null
      p.then(() => router.refresh())
    }
  }, [router])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [close])

  // Opening the bell marks unread items seen: the badge clears (and stays
  // cleared, even across a re-login) until something newer shows up. The items
  // themselves stay listed.
  function handleToggle() {
    if (open) return close()
    setOpen(true)
    const fresh = items.filter((n) => n.unread && !seenKeys.has(keyOf(n)))
    if (fresh.length) {
      setSeenKeys((prev) => new Set([...prev, ...fresh.map(keyOf)]))
      pending.current = markNotificationsSeen()
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleToggle}
        className="relative grid place-items-center w-9 h-9 rounded-full hover:bg-white/10 transition-colors"
        aria-label={count > 0 ? `${count} notification${count > 1 ? 's' : ''}` : 'Notifications'}
      >
        <Icon name="bell" className="w-5 h-5 text-white/85" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-3xs font-bold grid place-items-center ring-2 ring-[var(--header)]">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-[22rem] max-w-[calc(100vw-1.5rem)] rounded-2xl shadow-2xl overflow-hidden z-50 ef-card"
          style={{ border: '1px solid var(--border)' }}
        >
          {/* Header with gold accent bar */}
          <div className="relative px-4 py-3.5 border-b ef-border">
            <span className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: 'var(--sti-gold)' }} aria-hidden />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon name="bell" className="w-4 h-4" style={{ color: 'var(--sti-gold)' }} />
                <p className="font-bold text-sm" style={{ color: 'var(--card-foreground)' }}>Notifications</p>
              </div>
              {newInList > 0 && (
                <span className="px-2 py-0.5 rounded-full text-3xs font-bold bg-red-500 text-white">
                  {newInList} new
                </span>
              )}
            </div>
          </div>

          {items.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <div className="mx-auto mb-3 w-12 h-12 rounded-full grid place-items-center" style={{ backgroundColor: 'color-mix(in srgb, var(--sti-gold) 18%, transparent)' }}>
                <Icon name="bell" className="w-6 h-6" style={{ color: 'var(--sti-gold)' }} />
              </div>
              <p className="text-sm font-medium" style={{ color: 'var(--card-foreground)' }}>You&apos;re all caught up</p>
              <p className="text-xs ef-muted mt-0.5">New activity will show up here.</p>
            </div>
          ) : (
            <ul className="max-h-[22rem] overflow-y-auto divide-y ef-border">
              {items.map((n) => {
                const color = TONE[n.tone ?? 'info']
                const isNew = n.unread === true
                return (
                  <li key={n.id}>
                    <Link
                      href={n.href}
                      onClick={close}
                      className="group flex items-center gap-3 px-3.5 py-3 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
                      style={isNew ? { backgroundColor: 'color-mix(in srgb, var(--sti-gold) 9%, transparent)' } : undefined}
                    >
                      <span
                        className="shrink-0 w-9 h-9 rounded-full grid place-items-center"
                        style={{ backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`, color }}
                      >
                        <Icon name={n.icon ?? 'bell'} className="w-[18px] h-[18px]" />
                      </span>
                      <span className={`text-sm leading-snug flex-1 ${isNew ? 'font-semibold' : ''}`} style={{ color: 'var(--card-foreground)' }}>
                        {n.text}
                      </span>
                      {isNew && (
                        <span className="shrink-0 w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--sti-gold)' }} aria-label="New" />
                      )}
                      <Icon
                        name="chevron-right"
                        className="w-4 h-4 shrink-0 ef-muted opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-[opacity,translate] duration-200 ease-[var(--ease-out)]"
                      />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
