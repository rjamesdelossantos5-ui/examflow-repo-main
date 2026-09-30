'use client'

import { useMemo, useState, useTransition } from 'react'
import * as XLSX from 'xlsx'
import { saveTestEnrollments, generateTestTeachers, cleanUpTestData } from './actions'

interface Props {
  sections: string[]
  enrollments: { email: string; section: string }[]
  testTeachers: { name: string; email: string }[]
  migrationMissing: boolean
}

const card = 'ef-card rounded-xl shadow-sm p-5 sm:p-6 space-y-4'
const inputClass = 'w-full rounded-lg px-3 py-2 text-sm bg-transparent border ef-border focus:outline-none focus:ring-2 focus:ring-[var(--sti-gold)]'
const goldButton = 'px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed'
const gold = { backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' } as React.CSSProperties

/**
 * Testing tools — made-up data standing in for the school's confidential
 * enrollment records, so the full flow can be demonstrated. Only shown when
 * ENABLE_TEST_TOOLS=true.
 */
export default function TestingTools({ sections, enrollments, testTeachers, migrationMissing }: Props) {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Testing Tools</h2>
        <p className="text-sm ef-muted mt-1">
          The school&apos;s real enrollment records are confidential, so tests use made-up data. Everything here can be
          removed with Clean up. Turn these tools off for real use by removing <code>ENABLE_TEST_TOOLS</code>.
        </p>
      </div>
      {migrationMissing && (
        <div role="alert" className="rounded-lg border px-4 py-3 text-sm" style={{ borderColor: 'var(--status-danger)', color: 'var(--status-danger)' }}>
          Run <code>supabase/migration_class_schedule.sql</code> in the Supabase SQL editor first.
        </div>
      )}
      {sections.length === 0 && (
        <div className="rounded-lg border ef-border px-4 py-3 text-sm ef-muted">
          There is no class schedule yet. Import one on <a href="/admin/schedule" className="underline underline-offset-2">Class Schedule</a> first — both tools use its sections.
        </div>
      )}
      <MockEnrollment enrollments={enrollments} />
      <TestTeachers sections={sections} testTeachers={testTeachers} />
      <CleanUp count={{ enrollments: enrollments.length, teachers: testTeachers.length }} />
    </div>
  )
}

function MockEnrollment({ enrollments }: { enrollments: Props['enrollments'] }) {
  const [message, setMessage] = useState<{ ok: boolean; text: string; skipped?: { row: number; reason: string }[] } | null>(null)
  const [isPending, startTransition] = useTransition()

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([['Email', 'Section'], ['yourname.123456@stamaria.sti.edu.ph', 'BSIT 2-201']])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Enrollment')
    XLSX.writeFile(wb, 'mock-enrollment-template.xlsx')
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setMessage(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'array' })
        const grid = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' }) as unknown[][]
        const head = (grid[0] ?? []).map((c) => String(c).trim().toLowerCase())
        const E = head.indexOf('email'), S = head.indexOf('section')
        if (E < 0 || S < 0) return setMessage({ ok: false, text: 'The first row must have the columns Email and Section.' })
        const rows = grid.slice(1).map((r) => ({ email: String(r[E] ?? ''), section: String(r[S] ?? '') })).filter((r) => r.email || r.section)
        startTransition(async () => {
          const res = await saveTestEnrollments(rows)
          setMessage(res.error
            ? { ok: false, text: res.error, skipped: res.skipped }
            : { ok: true, text: `Saved ${res.saved} student${res.saved === 1 ? '' : 's'}. This replaced the previous list.`, skipped: res.skipped })
        })
      } catch {
        setMessage({ ok: false, text: 'Could not read this file. Make sure it is a valid .xlsx file.' })
      }
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }

  return (
    <section className={card}>
      <div>
        <h3 className="font-semibold" style={{ color: 'var(--card-foreground)' }}>Mock enrollment list</h3>
        <p className="text-2xs sm:text-xs ef-muted mt-1">
          Made-up enrollment for your test students: their school email and the section they&apos;re &quot;enrolled&quot; in.
          When one of them starts a new request, their course, year and section are filled in and only that section&apos;s
          subjects are listed — how it would work if the school shared its enrollment data.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={downloadTemplate} className="px-3 py-2 rounded-lg text-sm font-medium border ef-border" style={{ color: 'var(--card-foreground)' }}>
          Download template
        </button>
        <input
          type="file"
          accept=".xlsx"
          onChange={handleFile}
          disabled={isPending}
          aria-label="Upload the mock enrollment list"
          className="block text-sm ef-muted file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:cursor-pointer file:bg-[var(--sti-gold)] file:text-[var(--sti-navy)]"
        />
      </div>
      {isPending && <p className="text-xs ef-muted">Saving…</p>}
      {message && (
        <div className="text-xs space-y-1">
          <p role={message.ok ? 'status' : 'alert'} style={{ color: message.ok ? 'var(--status-success)' : 'var(--status-danger)' }}>{message.text}</p>
          {!!message.skipped?.length && (
            <ul className="ef-muted list-disc pl-5">
              {message.skipped.map((s) => <li key={s.row}>Row {s.row}: {s.reason}</li>)}
            </ul>
          )}
        </div>
      )}
      <div>
        <p className="text-xs font-semibold ef-muted mb-1.5">{enrollments.length} student{enrollments.length === 1 ? '' : 's'} on the list</p>
        {enrollments.length > 0 && (
          <ul className="text-xs divide-y ef-border rounded-lg border ef-border max-h-56 overflow-y-auto">
            {enrollments.map((e) => (
              <li key={e.email} className="flex justify-between gap-3 px-3 py-2">
                <span className="truncate" style={{ color: 'var(--card-foreground)' }}>{e.email}</span>
                <span className="font-mono shrink-0 ef-muted">{e.section}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function TestTeachers({ sections, testTeachers }: { sections: string[]; testTeachers: Props['testTeachers'] }) {
  const [filter, setFilter] = useState('')
  const [picked, setPicked] = useState<Set<string>>(() => new Set())
  const [inbox, setInbox] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [made, setMade] = useState<{ name: string; email: string; classes: number; reused: boolean }[]>([])
  const [isPending, startTransition] = useTransition()
  const shown = useMemo(() => sections.filter((s) => s.toLowerCase().includes(filter.trim().toLowerCase())), [sections, filter])

  function toggle(s: string) {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s)
      else next.add(s)
      return next
    })
  }

  function generate() {
    setMessage(null)
    startTransition(async () => {
      const res = await generateTestTeachers({ sections: [...picked], inbox, password })
      setMade(res.teachers ?? [])
      setMessage(res.error
        ? { ok: false, text: res.error }
        : { ok: true, text: `${res.teachers.length} test teacher${res.teachers.length === 1 ? '' : 's'} ready. Each logs in with the email below and the password you typed.` })
    })
  }

  return (
    <section className={card}>
      <div>
        <h3 className="font-semibold" style={{ color: 'var(--card-foreground)' }}>Test teacher accounts</h3>
        <p className="text-2xs sm:text-xs ef-muted mt-1">
          Pick sections: one test teacher is made for each instructor teaching them, and those classes are pointed at it.
          All of their emails go to one real inbox (as <code>name+test-surname@…</code>), so every teacher notification
          arrives in one place. Clean up puts the real teachers back.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-xs ef-muted space-y-1">
          <span>Group inbox (a real school email your team can open)</span>
          <input type="email" value={inbox} onChange={(e) => setInbox(e.target.value)} placeholder="yourname.123456@stamaria.sti.edu.ph" className={inputClass} style={{ color: 'var(--card-foreground)' }} />
        </label>
        <label className="text-xs ef-muted space-y-1">
          <span>Password for every test teacher (8+ characters)</span>
          <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" className={inputClass} style={{ color: 'var(--card-foreground)' }} />
        </label>
      </div>
      <div>
        <div className="flex items-center justify-between gap-3 mb-2">
          <p className="text-xs font-semibold ef-muted">{picked.size} section{picked.size === 1 ? '' : 's'} picked</p>
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter, e.g. BSIT 2" aria-label="Filter sections" className={`${inputClass} max-w-[12rem]`} style={{ color: 'var(--card-foreground)' }} />
        </div>
        <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
          {shown.map((s) => {
            const on = picked.has(s)
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggle(s)}
                aria-pressed={on}
                className="px-2.5 py-1.5 rounded-full text-xs font-mono border transition-colors"
                style={on ? { ...gold, borderColor: 'var(--sti-gold)' } : { borderColor: 'var(--border)', color: 'var(--card-foreground)' }}
              >
                {s}
              </button>
            )
          })}
        </div>
      </div>
      <button type="button" onClick={generate} disabled={isPending || !picked.size || !inbox || password.length < 8} className={goldButton} style={gold}>
        {isPending ? 'Creating…' : 'Create test teachers'}
      </button>
      {message && <p role={message.ok ? 'status' : 'alert'} className="text-xs" style={{ color: message.ok ? 'var(--status-success)' : 'var(--status-danger)' }}>{message.text}</p>}
      {made.length > 0 && (
        <ul className="text-xs divide-y ef-border rounded-lg border ef-border">
          {made.map((t) => (
            <li key={t.email} className="px-3 py-2 flex flex-wrap justify-between gap-2">
              <span style={{ color: 'var(--card-foreground)' }}>{t.name}{t.reused ? ' (already existed)' : ''}</span>
              <span className="font-mono ef-muted">{t.email} · {t.classes} class{t.classes === 1 ? '' : 'es'}</span>
            </li>
          ))}
        </ul>
      )}
      {testTeachers.length > 0 && (
        <p className="text-2xs ef-muted">{testTeachers.length} test teacher account{testTeachers.length === 1 ? '' : 's'} exist now.</p>
      )}
    </section>
  )
}

function CleanUp({ count }: { count: { enrollments: number; teachers: number } }) {
  const [confirming, setConfirming] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  function run() {
    startTransition(async () => {
      const res = await cleanUpTestData()
      setConfirming(false)
      if (res.error) return setMessage({ ok: false, text: res.error })
      const kept = res.kept ?? 0
      setMessage({
        ok: kept === 0,
        text: `Removed the enrollment list and ${res.deleted} test teacher${res.deleted === 1 ? '' : 's'}; ${res.relinked} class${res.relinked === 1 ? '' : 'es'} returned to their real teacher.` +
          (kept ? ` ${kept} test teacher${kept === 1 ? ' was' : 's were'} kept because they already acted on a request — run Reset Test Data, then Clean up again.` : ''),
      })
    })
  }

  return (
    <section className={card}>
      <div>
        <h3 className="font-semibold" style={{ color: 'var(--card-foreground)' }}>Clean up</h3>
        <p className="text-2xs sm:text-xs ef-muted mt-1">
          Deletes the mock enrollment list ({count.enrollments}) and every test teacher account ({count.teachers}). Real
          accounts and the class schedule stay. Test requests are removed separately with Reset Test Data.
        </p>
      </div>
      {!confirming ? (
        <button type="button" onClick={() => setConfirming(true)} disabled={isPending} className="px-4 py-2.5 rounded-lg text-sm font-semibold border" style={{ borderColor: 'var(--status-danger)', color: 'var(--status-danger)' }}>
          Clean up test data
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium" style={{ color: 'var(--card-foreground)' }}>Delete all test data?</span>
          <button type="button" onClick={run} disabled={isPending} className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: 'var(--status-danger)' }}>
            {isPending ? 'Cleaning up…' : 'Yes, delete'}
          </button>
          <button type="button" onClick={() => setConfirming(false)} disabled={isPending} className="px-3 py-2.5 rounded-lg text-sm ef-muted">Cancel</button>
        </div>
      )}
      {message && <p role={message.ok ? 'status' : 'alert'} className="text-xs" style={{ color: message.ok ? 'var(--status-success)' : 'var(--status-warning)' }}>{message.text}</p>}
    </section>
  )
}
