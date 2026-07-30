'use client'

import { useState, type ComponentProps } from 'react'
import ScheduleAnnouncementModal from './ScheduleAnnouncementModal'
import SubmissionStatusModal from './SubmissionStatusModal'

/**
 * Sequences the two one-time student popups so they never overlap AND the second
 * one appears the instant the first is dismissed.
 *
 * Previously the page picked ONE popup server-side; the second only surfaced
 * after the first was acknowledged and a background refresh re-evaluated — which
 * felt like the window popup lagged in ~10 seconds late. Here the schedule popup
 * (higher priority) shows first, and dismissing it immediately mounts the
 * window popup on the client — no refresh, no delay.
 */
export default function StudentAnnouncements({
  schedule,
  window: win,
}: {
  schedule: ComponentProps<typeof ScheduleAnnouncementModal> | null
  window: ComponentProps<typeof SubmissionStatusModal>
}) {
  const [scheduleClosed, setScheduleClosed] = useState(false)

  if (schedule && schedule.show && !scheduleClosed) {
    return <ScheduleAnnouncementModal {...schedule} onClose={() => setScheduleClosed(true)} />
  }
  if (win.show) {
    return <SubmissionStatusModal {...win} />
  }
  return null
}
