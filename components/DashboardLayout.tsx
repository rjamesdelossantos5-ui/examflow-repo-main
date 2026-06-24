'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import UserMenu from './UserMenu'
import { ROLE_HOME } from '@/lib/nav'
import type { UserRole } from '@/lib/supabase/types'

interface NavItem {
  label: string
  href: string
}

interface Props {
  role: UserRole
  userName: string
  email?: string
  navItems: NavItem[]
  children: React.ReactNode
}

export default function DashboardLayout({ role, userName, email, navItems, children }: Props) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
      {/* Top bar: brand + account */}
      <header className="shadow-sm relative z-50" style={{ backgroundColor: 'var(--header)' }}>
        <div className="max-w-[1600px] mx-auto px-3 sm:px-5 lg:px-8 h-16 flex items-center justify-between">
          <Link
            href={ROLE_HOME[role] ?? '/'}
            className="font-black text-xl hover:opacity-90 transition-opacity"
            style={{ color: 'var(--sti-gold)' }}
          >
            EXAMFLOW
          </Link>

          <div className="flex items-center gap-2">
            <UserMenu userName={userName} email={email} role={role} />
            {/* Mobile menu toggle */}
            {navItems.length > 0 && (
              <button
                className="md:hidden text-white p-1"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Toggle menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d={menuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Secondary nav row (below the brand) */}
        {navItems.length > 0 && (
          <div className="border-t border-white/10">
            <nav className="hidden md:flex max-w-[1600px] mx-auto px-3 sm:px-5 lg:px-8 gap-1">
              {navItems.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                      active
                        ? 'border-[var(--sti-gold)] text-[var(--sti-gold)]'
                        : 'border-transparent text-white/70 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </div>
        )}

        {/* Mobile nav */}
        {menuOpen && navItems.length > 0 && (
          <nav className="md:hidden px-4 pb-3 pt-1 flex flex-col gap-1 border-t border-white/10">
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
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-3 sm:px-5 lg:px-8 py-5 sm:py-6">
        {children}
      </main>
    </div>
  )
}
