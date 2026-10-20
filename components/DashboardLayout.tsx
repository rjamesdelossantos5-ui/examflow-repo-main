'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import UserMenu from './UserMenu'
import NotificationBell, { type NotificationItem } from './NotificationBell'
import LiveRefresh from './LiveRefresh'
import Toaster from './Toaster'
import { Icon, type IconName } from './Icon'
import { ROLE_HOME } from '@/lib/nav'
import type { UserRole } from '@/lib/supabase/types'

interface NavItem {
  label: string
  href: string
  icon?: IconName
  badge?: number
}

interface Props {
  role: UserRole
  userId?: string
  userName: string
  email?: string
  navItems: readonly NavItem[]
  /** Action-needed alerts for the header bell (e.g. paid requests awaiting a receipt). */
  notifications?: NotificationItem[]
  /**
   * Where the nav lives. 'top' (default) is the tab bar under the header that
   * every role uses; 'sidebar' puts the same items in a left panel (Admin).
   */
  navPosition?: 'top' | 'sidebar'
  /**
   * When set, a "Back" button is shown in the brand bar next to the logo. Used
   * when an admin is working on another role's page (Registrar, Teacher,
   * Program Head) so the way back to /admin/requests is always in view.
   */
  backHref?: string
  backLabel?: string
  children: React.ReactNode
}

export default function DashboardLayout({
  role,
  userId,
  userName,
  email,
  navItems,
  notifications,
  navPosition = 'top',
  backHref,
  backLabel = 'Back to request',
  children,
}: Props) {
  const pathname = usePathname()
  // Students only ever care about their OWN requests — scoping their realtime
  // subscription avoids a full page refresh every time ANY other student
  // submits/updates something. Staff roles still need the unfiltered feed
  // (they review everyone's requests), so no filter for them.
  const liveFilter = role === 'student' && userId ? `student_id=eq.${userId}` : undefined

  // Pick the single most-specific matching nav item (longest matching href),
  // so /teacher/history does not also light up /teacher.
  const activeHref = navItems
    .filter((it) => pathname === it.href || pathname.startsWith(it.href + '/'))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href

  const sidebar = navPosition === 'sidebar' && navItems.length > 0

  // Mobile only: the sidebar is a slide-in drawer below the lg breakpoint.
  // We remember WHICH page the drawer was opened on; it counts as open only
  // while we are still on that page, so it closes by itself on navigation —
  // no effect needed.
  const [drawerOpenedOn, setDrawerOpenedOn] = useState<string | null>(null)
  const drawerOpen = drawerOpenedOn === pathname
  const setDrawerOpen = (open: boolean) => setDrawerOpenedOn(open ? pathname : null)

  // Desktop only (lg and up): the burger hides the sidebar so the page gets the
  // full width, and shows it again. Not remembered across reloads.
  const [collapsed, setCollapsed] = useState(false)

  const brand = (
    <Link
      href={ROLE_HOME[role] ?? '/'}
      className="font-black text-xl tracking-tight hover:opacity-90 transition-opacity"
      style={{ color: 'var(--sti-gold)' }}
    >
      EXAM<span className="text-white">FLOW</span>
    </Link>
  )

  const backButton = backHref ? (
    <Link
      href={backHref}
      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap shadow-sm transition-opacity hover:opacity-90"
      style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
    >
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M19 12H5M11 6l-6 6 6 6" />
      </svg>
      <span className="hidden sm:inline">{backLabel}</span>
      <span className="sm:hidden">Back</span>
    </Link>
  ) : null

  // Logo, plus the back button when one was asked for.
  const brandArea = (
    <div className="flex items-center gap-3 sm:gap-4">
      {brand}
      {backButton}
    </div>
  )

  const headerRight = (
    <div className="flex items-center gap-4 sm:gap-6">
      <NotificationBell items={notifications} />
      <UserMenu userName={userName} email={email} role={role} />
    </div>
  )

  // ---------------------------------------------------------------------
  // Sidebar layout (Admin): brand bar on top, nav panel on the left.
  // ---------------------------------------------------------------------
  if (sidebar) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
        <LiveRefresh filter={liveFilter} />
        <Toaster />

        {/* Brand bar — sticky so the sidebar (top-16) always sits right under it */}
        <header className="sticky top-0 z-50" style={{ backgroundColor: 'var(--header)' }}>
          <div className="px-4 sm:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setDrawerOpen(!drawerOpen)}
                className="lg:hidden -ml-1 p-2 rounded-md text-white hover:bg-white/10 transition-colors"
                aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={drawerOpen}
              >
                <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  {drawerOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setCollapsed((c) => !c)}
                className="hidden lg:block -ml-1 p-2 rounded-md text-white hover:bg-white/10 transition-colors"
                aria-label={collapsed ? 'Show menu' : 'Hide menu'}
                aria-expanded={!collapsed}
              >
                <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              </button>
              {brandArea}
            </div>
            {headerRight}
          </div>
        </header>

        <div className="flex flex-1 min-w-0">
          {/* Dark backdrop behind the mobile drawer */}
          {drawerOpen && (
            <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setDrawerOpen(false)} aria-hidden />
          )}

          <aside
            className={`fixed lg:sticky top-16 left-0 z-40 lg:z-30 w-64 shrink-0 h-[calc(100vh-4rem)] overflow-y-auto transition-transform duration-200 lg:translate-x-0 ${
              drawerOpen ? 'translate-x-0' : '-translate-x-full'
            } ${collapsed ? 'lg:hidden' : ''}`}
            style={{ backgroundColor: 'var(--header)', borderRight: '1px solid rgba(255,255,255,0.08)' }}
          >
            <nav className="flex flex-col gap-1 p-3">
              {navItems.map((item) => {
                const active = item.href === activeHref
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      active ? 'shadow-sm' : 'hover:bg-white/10'
                    }`}
                    style={
                      active
                        ? { backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }
                        : { color: 'rgba(255,255,255,0.75)' }
                    }
                  >
                    {item.icon && <Icon name={item.icon} className="w-4 h-4 shrink-0" />}
                    <span className="truncate">{item.label}</span>
                    {item.badge ? (
                      <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-3xs font-bold grid place-items-center">
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                )
              })}
            </nav>
          </aside>

          {/* Page content */}
          <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 pt-4 pb-6 sm:pb-8">{children}</main>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------
  // Default layout (every other role): unchanged — header + top tab bar.
  // ---------------------------------------------------------------------
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
      <LiveRefresh filter={liveFilter} />
      <Toaster />
      {/* Brand bar */}
      <header className="relative z-50" style={{ backgroundColor: 'var(--header)' }}>
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {brandArea}
          {headerRight}
        </div>
      </header>

      {/* Sub-nav bar (light surface, clearly separated from the brand bar) */}
      {navItems.length > 0 && (
        <div
          className="sticky top-0 z-40"
          style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)' }}
        >
          {/* The scrollbar stays visible (thin): when the window is narrow or the
              browser is zoomed in, the tabs overflow, and with the bar hidden
              a mouse user had no way to tell they could scroll or how. */}
          <nav className="max-w-[1600px] mx-auto px-3 sm:px-5 lg:px-8 flex gap-1.5 overflow-x-auto py-2.5 items-center [scrollbar-width:thin]">
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
                  {item.badge ? (
                    <span className="ml-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-3xs font-bold grid place-items-center">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              )
            })}
          </nav>
        </div>
      )}

      {/* Page content */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-4 pb-6 sm:pb-8">
        {children}
      </main>
    </div>
  )
}
