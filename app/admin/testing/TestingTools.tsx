'use client'

import { useState, useTransition } from 'react'
import * as XLSX from 'xlsx'
import { saveTestEnrollments, cleanUpTestData } from './actions'

interface Props {
  sections: string[]
  enrollments: { email: string; section: string }[]
  migrationMissing: boolean
}

const card = 'ef-card rounded-xl shadow-sm p-5 sm:p-6 space-y-4'

/**
 * Testing tools — made-up data standing in for the school's confidential
 * enrollment records, so the full flow can be demonstrated. Only shown when
 * ENABLE_TEST_TOOLS=true.
 */
export default function TestingTools({ sections, enrollments, migrationMissing }: Props) {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Testing Tools</h2>
        <p className="text-sm ef-muted mt-1">
          The school&apos;s real enrollment records are confidential, so tests use a made-up enrollment list. Clean up
          removes it. Turn these tools off for real use by removing <code>ENABLE_TEST_TOOLS</code>.
        </p>
      </div>
      {migrationMissing && (
        <div role="alert" className="rounded-lg border px-4 py-3 text-sm" style={{ borderColor: 'var(--status-danger)', color: 'var(--status-danger)' }}>
          Run <code>supabase/migration_class_schedule.sql</code> in the Supabase SQL editor first.
        </div>
      )}
      {sections.length === 0 && (
        <div className="rounded-lg border ef-border px-4 py-3 text-sm ef-muted">
          There is no class schedule yet. Import one on <a href="/admin/schedule" className="underline underline-offset-2">Class Schedule</a> first — the enrollment list uses its sections.
        </div>
      )}
      <MockEnrollment enrollments={enrollments} />
      <CleanUp count={enrollments.length} />
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

function CleanUp({ count }: { count: number }) {
  const [confirming, setConfirming] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  function run() {
    startTransition(async () => {
      const res = await cleanUpTestData()
      setConfirming(false)
      if (res.error) return setMessage({ ok: false, text: res.error })
      setMessage({ ok: true, text: `Removed ${res.removed} student${res.removed === 1 ? '' : 's'} from the mock enrollment list.` })
    })
  }

  return (
    <section className={card}>
      <div>
        <h3 className="font-semibold" style={{ color: 'var(--card-foreground)' }}>Clean up</h3>
        <p className="text-2xs sm:text-xs ef-muted mt-1">
          Deletes the mock enrollment list ({count} student{count === 1 ? '' : 's'}). Accounts and the class schedule stay.
          Test requests are removed separately with Reset Test Data.
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
