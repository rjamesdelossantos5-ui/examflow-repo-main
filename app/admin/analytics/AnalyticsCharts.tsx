'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Icon, type IconName } from '@/components/Icon'
import { TERM_LABEL, SEMESTER_LABEL, type Term, type Semester } from '@/lib/examSettings'
import type { ExamStatRow } from '@/lib/examAnalytics'

type Dimension = 'department' | 'subject' | 'examType' | 'term'
type ChartKind = 'pie' | 'bar'

const DIMENSIONS: { value: Dimension; label: string }[] = [
  { value: 'department', label: 'Department' },
  { value: 'subject', label: 'Subject' },
  { value: 'examType', label: 'Exam Type' },
  { value: 'term', label: 'Term' },
]

// Categorical palette for chart fills — brand colors first, then a curated set
// chosen to stay legible on both the light and dark card background (these are
// decorative marks, not text, so they don't need to individually pass the AA
// text-contrast bar the way the --status-* variables do).
const PALETTE = [
  'var(--sti-gold)', 'var(--sti-navy)', 'var(--status-info)', 'var(--status-success)',
  'var(--status-warning)', 'var(--status-danger)', '#8b5cf6', '#14b8a6',
]

// Cap the number of slices/bars shown — a pie (or bar) chart with 30 subject
// categories is unreadable regardless of chart type, so anything past this
// collapses into a single "Other" bucket.
const MAX_CATEGORIES = 8

function keyFor(row: ExamStatRow, dim: Dimension): string {
  switch (dim) {
    case 'department': return row.departmentName
    case 'subject': return `${row.subjectCode} — ${row.subjectName}`
    case 'examType': return row.examType === 'paid' ? 'Paid' : 'Excused'
    case 'term': {
      const sem = row.semester ? (SEMESTER_LABEL[row.semester as Semester] ?? row.semester) : null
      const term = row.term ? (TERM_LABEL[row.term as Term] ?? row.term) : null
      return [sem, term].filter(Boolean).join(' · ') || 'Unknown term'
    }
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

export default function AnalyticsCharts({ rows }: { rows: ExamStatRow[] }) {
  const [dimension, setDimension] = useState<Dimension>('department')
  const [chartKind, setChartKind] = useState<ChartKind>('pie')
  const reducedMotion = useReducedMotion()

  const totals = useMemo(() => ({
    total: rows.length,
    paid: rows.filter((r) => r.examType === 'paid').length,
    excused: rows.filter((r) => r.examType === 'excused').length,
    departments: new Set(rows.map((r) => r.departmentName)).size,
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

  const tooltipStyle = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--card-foreground)', fontSize: 13 }

  return (
    <div className="space-y-5">
      {/* Stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Total Exams Taken" value={totals.total} icon="layers" accent="var(--status-neutral)" />
        <StatTile label="Paid" value={totals.paid} icon="receipt" accent="var(--status-warning)" />
        <StatTile label="Excused" value={totals.excused} icon="file" accent="var(--status-info)" />
        <StatTile label="Departments" value={totals.departments} icon="building" accent="var(--status-success)" />
      </div>

      {rows.length === 0 ? (
        <div className="ef-card rounded-xl shadow-sm px-4 py-14 text-center">
          <div className="mx-auto mb-3 w-12 h-12 rounded-full grid place-items-center" style={{ background: 'color-mix(in srgb, var(--sti-gold) 16%, transparent)' }}>
            <Icon name="chart" className="w-6 h-6" style={{ color: 'var(--sti-gold)' }} />
          </div>
          <p className="font-medium" style={{ color: 'var(--card-foreground)' }}>No completed exams yet</p>
          <p className="text-sm ef-muted mt-1">Once students are scheduled for a special exam, their numbers will appear here.</p>
        </div>
      ) : (
        <div className="ef-card rounded-xl shadow-sm p-4 sm:p-6">
          {/* Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <div className="flex flex-wrap gap-1.5">
              {DIMENSIONS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setDimension(d.value)}
                  className={`ef-press px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    dimension === d.value ? '' : 'border ef-border hover:bg-black/[0.03] dark:hover:bg-white/[0.05]'
                  }`}
                  style={dimension === d.value ? { background: 'var(--sti-gold)', color: 'var(--sti-navy)' } : { color: 'var(--card-foreground)' }}
                >
                  {d.label}
                </button>
              ))}
            </div>

            {/* Chart type toggle */}
            <div className="inline-flex rounded-full border ef-border p-0.5 self-start sm:self-auto">
              {(['pie', 'bar'] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setChartKind(kind)}
                  className={`ef-press px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors flex items-center gap-1.5 ${
                    chartKind === kind ? '' : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.05]'
                  }`}
                  style={chartKind === kind ? { background: 'var(--sti-navy)', color: '#fff' } : { color: 'var(--card-foreground)' }}
                  aria-pressed={chartKind === kind}
                >
                  <Icon name={kind === 'pie' ? 'chart' : 'list'} className="w-3.5 h-3.5" />
                  {kind} chart
                </button>
              ))}
            </div>
          </div>

          {groupedCount > 0 && (
            <p className="text-xs ef-muted mb-3">
              Showing top {chartData.length - 1} of {chartData.length - 1 + groupedCount} — the rest are grouped as &ldquo;Other&rdquo;.
            </p>
          )}

          {/* Chart */}
          <div style={{ width: '100%', height: Math.max(260, chartData.length * 44) }}>
            <ResponsiveContainer>
              {chartKind === 'pie' ? (
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="45%"
                    outerRadius="80%"
                    paddingAngle={2}
                    isAnimationActive={!reducedMotion}
                  >
                    {chartData.map((entry, i) => (
                      <Cell key={entry.name} fill={PALETTE[i % PALETTE.length]} stroke="var(--card)" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [`${value} student${value === 1 ? '' : 's'}`, name]} />
                </PieChart>
              ) : (
                <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                  <XAxis type="number" allowDecimals={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={140}
                    tick={{ fill: 'var(--card-foreground)', fontSize: 12 }}
                    axisLine={{ stroke: 'var(--border)' }}
                    tickLine={false}
                  />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'color-mix(in srgb, var(--sti-gold) 8%, transparent)' }} formatter={(value) => [`${value} student${value === 1 ? '' : 's'}`, 'Students']} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} isAnimationActive={!reducedMotion} maxBarSize={28}>
                    {chartData.map((entry, i) => (
                      <Cell key={entry.name} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Data table below the chart — same numbers, screen-reader and
              keyboard friendly, and keeps color from being the only way to
              tell categories apart (a chart alone never satisfies that). */}
          <div className="mt-5 pt-4 border-t ef-border">
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              {chartData.map((d, i) => {
                const pct = totals.total ? Math.round((d.value / totals.total) * 100) : 0
                return (
                  <li key={d.name} className="flex items-center gap-2 text-sm min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
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
