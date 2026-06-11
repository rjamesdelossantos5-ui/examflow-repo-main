import type { RequestStatus } from '@/lib/supabase/types'

const CONFIG: Record<RequestStatus, { label: string; classes: string }> = {
  submitted:              { label: 'Submitted',              classes: 'bg-blue-100 text-blue-700' },
  verified_by_registrar:  { label: 'Verified by Registrar',  classes: 'bg-purple-100 text-purple-700' },
  approved_by_teacher:    { label: 'Approved by Teacher',    classes: 'bg-indigo-100 text-indigo-700' },
  accepted:               { label: 'Accepted',               classes: 'bg-yellow-100 text-yellow-700' },
  receipt_uploaded:       { label: 'Receipt Uploaded',        classes: 'bg-orange-100 text-orange-700' },
  scheduled:              { label: 'Scheduled',              classes: 'bg-green-100 text-green-700' },
  rejected:               { label: 'Rejected',               classes: 'bg-red-100 text-red-700' },
}

export default function StatusBadge({ status }: { status: RequestStatus }) {
  const { label, classes } = CONFIG[status] ?? { label: status, classes: 'bg-gray-100 text-gray-700' }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${classes}`}>
      {label}
    </span>
  )
}
