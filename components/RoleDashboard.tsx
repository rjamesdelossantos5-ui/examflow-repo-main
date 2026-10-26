'use client'

import { useState } from 'react'
import { StatCard } from '@/app/student/RequestsPanel'
import { Icon } from '@/components/Icon'
import Pagination, { usePagination } from '@/components/Pagination'
import type { DashboardData } from '@/lib/roleDashboard'

/**
 * Landing page for the Teacher, Registrar and Program Head: a welcome line, a
 * row of stat cards, and the requests broken down by subject and section. Like
 * the student's dashboard, the cards double as filters — clicking one keeps only
 * the subject/section rows that have something under it.
 */
export default function RoleDashboard({ data }: { data: DashboardData }) {
  const [filter, setFilter] = useState('total')
  const toggle = (key: string) => setFilter((cur) => (cur === key && key !== 'total' ? 'total' : key))

  const shown = filter === 'total' ? data.groups : data.groups.filter((g) => (g.counts[filter] ?? 0) > 0)
  const pager = usePagination(shown, filter)
  const pageRows = pager.items
  const activeLabel = data.cards.find((c) => c.key === filter)?.label ?? ''

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{data.greeting}</h1>
        <p className="text-sm ef-muted">{data.subtitle}</p>
      </div>

      <div className={`grid grid-cols-2 gap-3 ${data.cards.length > 4 ? 'sm:grid-cols-3 lg:grid-cols-5' : 'sm:grid-cols-4'}`}>
        {data.cards.map((c) => (
          <StatCard key={c.key} label={c.label} value={c.value} accent={c.accent} icon={c.icon} active={filter === c.key} onClick={() => toggle(c.key)} />
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-sm font-semibold ef-muted uppercase tracking-wide">
            By subject and section{data.termLabel ? ` · ${data.termLabel}` : ''}
          </h2>
          {filter !== 'total' && (
            <button type="button" onClick={() => setFilter('total')} className="text-xs font-semibold underline ef-muted">
              Clear filter
            </button>
          )}
        </div>

        {data.groups.length === 0 ? (
          <div className="ef-card rounded-xl shadow-sm px-4 py-14 text-center">
            <div className="mx-auto mb-3 w-12 h-12 rounded-full grid place-items-center" style={{ background: 'color-mix(in srgb, var(--sti-yellow) 16%, transparent)' }}>
              <Icon name="file" className="w-6 h-6" style={{ color: 'var(--sti-blue)' }} />
            </div>
            <p className="font-medium" style={{ color: 'var(--card-foreground)' }}>{data.empty}</p>
          </div>
        ) : shown.length === 0 ? (
          <div className="ef-card rounded-xl shadow-sm px-4 py-10 text-center">
            <p className="font-medium" style={{ color: 'var(--card-foreground)' }}>No subjects or sections under “{activeLabel}”.</p>
          </div>
        ) : (
          <>
          <div className="ef-card rounded-xl shadow-sm overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b ef-border text-left text-xs font-semibold ef-muted uppercase tracking-wide">
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Section</th>
                  {data.cards.map((c) => (
                    <th key={c.key} className={`px-4 py-3 text-right whitespace-nowrap ${filter === c.key ? 'text-[var(--card-foreground)]' : ''}`}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y ef-border">
                {pageRows.map((g) => (
                  <tr key={g.id}>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--card-foreground)' }}>{g.subject}</td>
                    <td className="px-4 py-3 ef-muted whitespace-nowrap">{g.section ?? '—'}</td>
                    {data.cards.map((c) => {
                      const n = g.counts[c.key] ?? 0
                      return (
                        <td key={c.key} className={`px-4 py-3 text-right tabular-nums ${n ? '' : 'ef-muted'} ${filter === c.key ? 'font-semibold' : ''}`} style={n ? { color: 'var(--card-foreground)' } : undefined}>
                          {n}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination {...pager.pagerProps} />
          </>
        )}
      </div>
    </div>
  )
}
