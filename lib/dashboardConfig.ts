// What each staff dashboard counts. Plain data and functions, no server imports,
// so both the loader (lib/roleDashboard.ts) and the page can use it.

import type { IconName } from '@/components/Icon'

export type DashRole = 'subject_teacher' | 'registrar' | 'program_head'

/** The few facts about one request that the cards are decided from. */
export interface DashRow {
  status: string
  examType: string
  rejectedBy: string | null
  /** Paid requests only: the Registrar has totalled the fee (payment_assessed_at). */
  assessed: boolean
}

export interface DashCardDef {
  key: string
  label: string
  icon: IconName
  accent: string
  /** True when a request counts toward this card. 'total' is every request the role deals with. */
  match: (r: DashRow) => boolean
}

// The Teacher's queue is every request at 'submitted' (parent verified, student
// pressed Submit — lib/submissionGate.ts); approving moves it on to the Program
// Head. The Registrar no longer verifies requests first, so nothing here waits
// on them.
export const DASHBOARD: Record<DashRole, { subtitle: string; empty: string; cards: DashCardDef[] }> = {
  subject_teacher: {
    subtitle: 'Here’s an overview of the special exam requests for the subjects and sections you teach.',
    empty: 'No requests for your classes yet.',
    cards: [
      { key: 'total', label: 'Total Requests', icon: 'layers', accent: 'var(--status-neutral)', match: () => true },
      { key: 'awaiting', label: 'Awaiting Me', icon: 'clock', accent: 'var(--status-info)', match: (r) => r.status === 'submitted' },
      {
        key: 'approved', label: 'Approved', icon: 'check', accent: 'var(--status-success)',
        match: (r) => ['approved_by_teacher', 'accepted', 'receipt_uploaded', 'scheduled'].includes(r.status),
      },
    ],
  },
  // The Registrar's work is the fee assessment of paid requests (and the parent
  // list), so the cards follow that.
  registrar: {
    subtitle: 'Here’s an overview of the special exam requests across the school.',
    empty: 'No requests yet.',
    cards: [
      { key: 'total', label: 'Total Requests', icon: 'layers', accent: 'var(--status-neutral)', match: () => true },
      {
        key: 'assess', label: 'Awaiting Assessment', icon: 'receipt', accent: 'var(--status-warning)',
        match: (r) => r.status === 'accepted' && r.examType === 'paid' && !r.assessed,
      },
      {
        key: 'assessed', label: 'Assessed', icon: 'check', accent: 'var(--status-success)',
        match: (r) => r.examType === 'paid' && r.assessed && r.status !== 'rejected',
      },
      { key: 'rejected', label: 'Rejected', icon: 'x-circle', accent: 'var(--status-danger)', match: (r) => r.status === 'rejected' },
    ],
  },
  program_head: {
    subtitle: 'Here’s an overview of the special exam requests in your department.',
    empty: 'No requests in your department yet.',
    cards: [
      { key: 'total', label: 'Total Requests', icon: 'layers', accent: 'var(--status-neutral)', match: () => true },
      { key: 'approval', label: 'Awaiting Approval', icon: 'inbox', accent: 'var(--status-info)', match: (r) => r.status === 'approved_by_teacher' },
      { key: 'receipts', label: 'Receipts to Check', icon: 'receipt', accent: 'var(--status-warning)', match: (r) => r.status === 'receipt_uploaded' },
      { key: 'scheduled', label: 'Scheduled', icon: 'calendar', accent: 'var(--status-success)', match: (r) => r.status === 'scheduled' },
      { key: 'rejected', label: 'Rejected', icon: 'x-circle', accent: 'var(--status-danger)', match: (r) => r.status === 'rejected' },
    ],
  },
}
