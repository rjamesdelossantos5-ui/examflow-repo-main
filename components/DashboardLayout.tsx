'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/login/actions'
import type { UserRole } from '@/lib/supabase/types'

interface NavItem {
  label: string
  href: string
}

interface Props {
  role: UserRole
  userName: string
  navItems: NavItem[]
  children: React.ReactNode
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrator',
  registrar: 'Registrar',
  subject_teacher: 'Subject Teacher',
  program_head: 'Program Head',
  student: 'Student',
}

export default function DashboardLayout({ role, userName, navItems, children }: Props) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Top Nav */}
      <header className="shadow-sm" style={{ backgroundColor: 'var(--sti-navy)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className="font-black text-lg"
              style={{ color: 'var(--sti-gold)' }}
            >
              EXAMFLOW
            </span>
            <span className="text-white/40 hidden sm:block">|</span>
            <span className="text-white/80 text-sm hidden sm:block">{ROLE_LABELS[role]}</span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  pathname === item.href || pathname.startsWith(item.href + '/')
                    ? 'text-[var(--sti-navy)] bg-[var(--sti-gold)]'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <span className="text-white/70 text-sm hidden sm:block">{userName}</span>
            <form action={logout}>
              <button
                type="submit"
                className="text-xs px-3 py-1.5 rounded font-medium transition-colors"
                style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
              >
                Sign Out
              </button>
            </form>
            {/* Mobile menu toggle */}
            <button
              className="md:hidden text-white"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d={menuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {menuOpen && (
          <nav className="md:hidden px-4 pb-3 flex flex-col gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={`px-3 py-2 rounded text-sm font-medium ${
                  pathname === item.href
                    ? 'text-[var(--sti-navy)] bg-[var(--sti-gold)]'
                    : 'text-white/80'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {children}
      </main>
    </div>
  )
}
