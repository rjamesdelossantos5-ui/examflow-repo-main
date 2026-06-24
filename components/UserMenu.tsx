'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { logout } from '@/app/login/actions'
import ThemeToggle from './ThemeToggle'
import { Icon } from './Icon'
import type { UserRole } from '@/lib/supabase/types'

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrator',
  registrar: 'Registrar',
  subject_teacher: 'Subject Teacher',
  program_head: 'Program Head',
  student: 'Student',
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'U'
}

export default function UserMenu({
  userName,
  email,
  role,
}: {
  userName: string
  email?: string
  role: UserRole
}) {
  const [open, setOpen] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 hover:bg-white/10 transition-colors"
        aria-label="Account menu"
      >
        <span
          className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
        >
          {initials(userName)}
        </span>
        <span className="hidden sm:flex flex-col items-start leading-tight max-w-[12rem]">
          <span className="text-white text-sm font-medium truncate max-w-[12rem]">{userName}</span>
          <span className="text-white/55 text-xs truncate max-w-[12rem]">{ROLE_LABELS[role]}</span>
        </span>
        <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-60 rounded-xl shadow-xl overflow-hidden z-50 ef-card"
          style={{ border: '1px solid var(--border)' }}
        >
          <div className="px-4 py-3 border-b ef-border">
            <p className="font-semibold text-sm truncate" style={{ color: 'var(--card-foreground)' }}>
              {userName}
            </p>
            {email && <p className="text-xs ef-muted truncate">{email}</p>}
            <span
              className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold"
              style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
            >
              {ROLE_LABELS[role]}
            </span>
          </div>

          <Link
            href="/account"
            onClick={() => setOpen(false)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            style={{ color: 'var(--card-foreground)' }}
          >
            <Icon name="user" className="w-4 h-4 opacity-70" />
            <span>My Account</span>
          </Link>

          <div style={{ color: 'var(--card-foreground)' }}>
            <ThemeToggle variant="menu" />
          </div>

          <div className="border-t ef-border">
            <button
              type="button"
              onClick={() => { setOpen(false); setConfirmLogout(true) }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
            >
              <Icon name="logout" className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}

      {/* Logout confirmation */}
      {confirmLogout && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={() => setConfirmLogout(false)}>
          <div className="ef-card rounded-xl shadow-xl max-w-sm w-full p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 w-12 h-12 rounded-full grid place-items-center bg-red-50 dark:bg-red-500/10 text-red-600">
              <Icon name="logout" className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg" style={{ color: 'var(--card-foreground)' }}>Sign out of EXAMFLOW?</h3>
            <p className="text-sm ef-muted mt-1 mb-5">You&apos;ll need to log in again to access your dashboard.</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmLogout(false)}
                className="flex-1 py-2.5 rounded-lg font-semibold text-sm border ef-border"
                style={{ color: 'var(--card-foreground)' }}
              >
                Cancel
              </button>
              <form action={logout} className="flex-1">
                <button type="submit" className="w-full py-2.5 rounded-lg font-semibold text-sm bg-red-600 text-white">
                  Sign Out
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
