'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import UserMenu from './UserMenu'
import NotificationBell, { type NotificationItem } from './NotificationBell'
import { Icon, type IconName } from './Icon'
import { ROLE_HOME } from '@/lib/nav'
import type { UserRole } from '@/lib/supabase/types'

interface NavItem {
  label: string
  href: string
  icon?: IconName
}

interface Props {
  role: UserRole
  userName: string
  email?: string
  navItems: readonly NavItem[]
  /** Action-needed alerts for the header bell (e.g. paid requests awaiting a receipt). */
  notifications?: NotificationItem[]
  children: React.ReactNode
}

export default function DashboardLayout({ role, userName, email, navItems, notifications, children }: Props) {
  const pathname = usePathname()

  // Pick the single most-specific matching nav item (longest matching href),
  // so /registrar/history doesn't also light up /registrar.
  const activeHref = navItems
    .filter((it) => pathname === it.href || pathname.startsWith(it.href + '/'))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
      {/* Brand bar */}
      <header className="relative z-50" style={{ backgroundColor: 'var(--header)' }}>
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link
            href={ROLE_HOME[role] ?? '/'}
            className="font-black text-xl tracking-tight hover:opacity-90 transition-opacity"
            style={{ color: 'var(--sti-gold)' }}
          >
            EXAM<span className="text-white">FLOW</span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-2">
            <NotificationBell items={notifications} />
            <UserMenu userName={userName} email={email} role={role} />
          </div>
        </div>
      </header>

      {/* Sub-nav bar (light surface, clearly separated from the brand bar) */}
      {navItems.length > 0 && (
        <div
          className="sticky top-0 z-40"
          style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)' }}
        >
          <nav className="max-w-[1600px] mx-auto px-3 sm:px-5 lg:px-8 flex gap-1.5 overflow-x-auto py-2.5 items-center no-scrollbar">
            {navItems.map((item) => {
              const active = item.href === activeHref
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    active ? 'shadow-sm' : 'hover:bg-black/5 dark:hover:bg-white/10'
                  }`}
                  style={
                    active
                      ? { backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }
                      : { color: 'var(--muted)' }
                  }
                >
                  {item.icon && <Icon name={item.icon} className="w-4 h-4" />}
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
      )}

      {/* Page content */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {children}
      </main>
    </div>
  )
}
