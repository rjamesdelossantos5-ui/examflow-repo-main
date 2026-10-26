'use client'

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Icon, type IconName } from '@/components/Icon'
import type { ExamStatRow } from '@/lib/examAnalytics'
import { TERMS, TERM_LABEL, type Term } from '@/lib/examSettings'

type Dimension = 'department' | 'subject' | 'examType'

const DIMENSIONS: { value: Dimension; label: string }[] = [
  { value: 'department', label: 'Department' },
  { value: 'subject', label: 'Subject' },
  { value: 'examType', label: 'Exam Type' },
]

// Categorical palette for chart fills — brand colors first, then a curated set
// chosen to stay legible on both the light and dark card background (these are
// decorative marks, not text, so they don't need to individually pass the AA
// text-contrast bar the way the --status-* variables do).
const PALETTE = [
  'var(--sti-blue)', 'var(--sti-navy)', 'var(--status-success)', 'var(--status-warning)',
  'var(--status-danger)', '#8b5cf6', '#14b8a6', 'var(--status-info)',
]

// Cap the number of slices/bars shown — a pie (or bar) chart with 30 subject
// categories is unreadable regardless of chart type, so anything past this
// collapses into a single "Other" bucket.
const MAX_CATEGORIES = 8

function keyFor(row: ExamStatRow, dim: Dimension): string {
  switch (dim) {
    case 'department': return row.departmentName
    case 'subject': return `${row.subjectCode} — ${row.subjectName}`
    case 'examType': return row.examType === 'paid' ? 'Paid' : 'Waived'
  }
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

// True on a desktop-width window (Tailwind's lg, 1024px). Read through
// useSyncExternalStore so it is right on first paint and follows a resize.
// Bar thickness and label sizes are numbers handed to Recharts, which CSS
// classes can't reach, so the charts need to know which size to draw.
function useIsDesktop() {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia('(min-width: 1024px)')
      mq.addEventListener('change', notify)
      return () => mq.removeEventListener('change', notify)
    },
    () => window.matchMedia('(min-width: 1024px)').matches,
    () => false,
  )
}

function StatTile({ label, value, icon, accent }: { label: string; value: number; icon: IconName; accent: string }) {
  return (
    <div className="ef-card rounded-xl shadow-sm p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3 min-w-0">
      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${accent} 16%, transparent)` }}>
        <Icon name={icon} className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: accent }} />
      </div>
      <div className="min-w-0">
        <p className="text-lg sm:text-2xl font-bold leading-none" style={{ color: 'var(--card-foreground)' }}>{value.toLocaleString()}</p>
        <p className="text-2xs sm:text-xs ef-muted mt-1 truncate">{label}</p>
      </div>
    </div>
  )
}

/**
 * singleDepartment: the rows are one department's (a Program Head's or a
 * Teacher's), so a Department breakdown would be one slice. It is left out,
 * the chart opens on Subject, and the fourth tile counts subjects instead.
 */
export default function AnalyticsCharts({ rows: semesterRows, singleDepartment = false }: { rows: ExamStatRow[]; singleDepartment?: boolean }) {
  const dimensions = singleDepartment ? DIMENSIONS.filter((d) => d.value !== 'department') : DIMENSIONS
  const [dimension, setDimension] = useState<Dimension>(dimensions[0].value)
  // 'all' = Overall (every term of the semester shown); otherwise one term.
  const [termFilter, setTermFilter] = useState<'all' | Term>('all')
  const reducedMotion = useReducedMotion()

  const rows = useMemo(
    () => (termFilter === 'all' ? semesterRows : semesterRows.filter((r) => r.term === termFilter)),
    [semesterRows, termFilter],
  )
  const termCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const r of semesterRows) if (r.term) c[r.term] = (c[r.term] ?? 0) + 1
    return c
  }, [semesterRows])

  const totals = useMemo(() => ({
    total: rows.length,
    paid: rows.filter((r) => r.examType === 'paid').length,
    excused: rows.filter((r) => r.examType === 'excused').length,
    departments: new Set(rows.map((r) => r.departmentName)).size,
    subjects: new Set(rows.map((r) => r.subjectCode)).size,
  }), [rows])

  const chartData = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of rows) {
      const key = keyFor(row, dimension)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
    if (sorted.length <= MAX_CATEGORIES) return sorted.map(([name, value]) => ({ name, value }))
    const top = sorted.slice(0, MAX_CATEGORIES - 1)
    const otherTotal = sorted.slice(MAX_CATEGORIES - 1).reduce((sum, [, v]) => sum + v, 0)
    return [...top.map(([name, value]) => ({ name, value })), { name: 'Other', value: otherTotal }]
  }, [rows, dimension])

  const groupedCount = useMemo(() => {
    const distinct = new Set(rows.map((r) => keyFor(r, dimension))).size
    return distinct - chartData.length + (chartData.some((d) => d.name === 'Other') ? 1 : 0)
  }, [rows, dimension, chartData])

  // Both charts share one height so they line up; it grows with the bar count.
  // Tall enough that each bar keeps a readable thickness however many categories
  // there are; the pie sits in the same height. Larger again on a desktop window.
  const desktop = useIsDesktop()
  // About 80% of the earlier sizes, which read as too large on a laptop screen.
  const chartHeight = desktop ? Math.max(448, chartData.length * 61) : Math.max(304, chartData.length * 45)
  const tickSize = desktop ? 13 : 12
  const labelWidth = desktop ? 200 : 152
  const labelChars = desktop ? 30 : 22
  const barMax = desktop ? 45 : 29

  const tooltipStyle = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--card-foreground)', fontSize: 13 }

  return (
    <div className="space-y-5">
      {/* Term choices: Overall for the whole semester, or one term. */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Term">
        {([['all', 'Overall', semesterRows.length], ...TERMS.map((t) => [t, TERM_LABEL[t], termCounts[t] ?? 0] as const)] as const).map(([value, label, count]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTermFilter(value as 'all' | Term)}
            aria-pressed={termFilter === value}
            className={`ef-press px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              termFilter === value ? '' : 'border ef-border hover:bg-black/[0.03] dark:hover:bg-white/[0.05]'
            }`}
            style={termFilter === value ? { background: 'var(--sti-yellow)', color: 'var(--sti-navy)' } : { color: 'var(--card-foreground)' }}
          >
            {label} <span className="tabular-nums opacity-70">({count})</span>
          </button>
        ))}
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Total Exams Taken" value={totals.total} icon="layers" accent="var(--status-neutral)" />
        <StatTile label="Paid" value={totals.paid} icon="receipt" accent="var(--status-warning)" />
        <StatTile label="Waived" value={totals.excused} icon="file" accent="var(--status-info)" />
        {singleDepartment
          ? <StatTile label="Subjects" value={totals.subjects} icon="book" accent="var(--status-success)" />
          : <StatTile label="Departments" value={totals.departments} icon="building" accent="var(--status-success)" />}
      </div>

      {rows.length === 0 ? (
        <div className="ef-card rounded-xl shadow-sm px-4 py-14 text-center">
          <div className="mx-auto mb-3 w-12 h-12 rounded-full grid place-items-center" style={{ background: 'color-mix(in srgb, var(--sti-yellow) 16%, transparent)' }}>
            <Icon name="chart" className="w-6 h-6" style={{ color: 'var(--sti-blue)' }} />
          </div>
          <p className="font-medium" style={{ color: 'var(--card-foreground)' }}>No completed exams yet</p>
          <p className="text-sm ef-muted mt-1">Once students are scheduled for a special exam, their numbers will appear here.</p>
        </div>
      ) : (
        <div className="ef-card rounded-xl shadow-sm p-4 sm:p-6">
          {/* Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <div className="flex flex-wrap gap-1.5">
              {dimensions.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setDimension(d.value)}
                  className={`ef-press px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    dimension === d.value ? '' : 'border ef-border hover:bg-black/[0.03] dark:hover:bg-white/[0.05]'
                  }`}
                  style={dimension === d.value ? { background: 'var(--sti-yellow)', color: 'var(--sti-navy)' } : { color: 'var(--card-foreground)' }}
                >
                  {d.label}
                </button>
              ))}
            </div>

          </div>

          {groupedCount > 0 && (
            <p className="text-xs ef-muted mb-3">
              Showing top {chartData.length - 1} of {chartData.length - 1 + groupedCount} — the rest are grouped as &ldquo;Other&rdquo;.
            </p>
          )}

          {/* Both charts at once: pie on the left, bar on the right (stacked on
              narrow screens). Same data and colours, so a slice and its bar match. */}
          <div className="grid gap-6 lg:grid-cols-2 items-center">
            <div style={{ width: '100%', height: chartHeight }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="45%"
                    outerRadius="88%"
                    paddingAngle={2}
                    isAnimationActive={!reducedMotion}
                  >
                    {chartData.map((entry, i) => (
                      <Cell key={entry.name} fill={PALETTE[i % PALETTE.length]} stroke="var(--card)" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [`${value} student${value === 1 ? '' : 's'}`, name]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ width: '100%', height: chartHeight }}>
              <ResponsiveContainer>
                <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                  <XAxis type="number" allowDecimals={false} tick={{ fill: 'var(--muted)', fontSize: tickSize }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={labelWidth}
                    tick={{ fill: 'var(--card-foreground)', fontSize: tickSize }}
                    // Long subject names are shortened here; the tooltip and the list
                    // below the charts keep the full name.
                    tickFormatter={(v: string) => (v.length > labelChars ? `${v.slice(0, labelChars - 1)}…` : v)}
                    axisLine={{ stroke: 'var(--border)' }}
                    tickLine={false}
                  />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'color-mix(in srgb, var(--sti-yellow) 8%, transparent)' }} formatter={(value) => [`${value} student${value === 1 ? '' : 's'}`, 'Students']} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} isAnimationActive={!reducedMotion} maxBarSize={barMax}>
                    {chartData.map((entry, i) => (
                      <Cell key={entry.name} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Data table below the chart — same numbers, screen-reader and
              keyboard friendly, and keeps color from being the only way to
              tell categories apart (a chart alone never satisfies that). */}
          <div className="mt-5 pt-4 border-t ef-border">
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              {chartData.map((d, i) => {
                const pct = totals.total ? Math.round((d.value / totals.total) * 100) : 0
                return (
                  <li key={d.name} className="flex items-center gap-2 text-sm lg:text-base min-w-0">
                    <span className="w-2.5 h-2.5 lg:w-3 lg:h-3 rounded-full shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                    <span className="truncate flex-1" style={{ color: 'var(--card-foreground)' }}>{d.name}</span>
                    <span className="ef-muted shrink-0">{d.value} · {pct}%</span>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
