// Preset rejection reasons per reviewer + context. Each list ends with 'Other',
// which reveals a free-text box in the picker. Kept here so the wording stays
// consistent everywhere it's shown.

export const OTHER = 'Other'

// Program Head reviews the excuse certificate (medical / death cert) for an
// excused request, so certificate-related reasons live here.
export const PH_REJECT_EXCUSED = [
  'Blurred or unreadable certificate',
  'Certificate does not match the reason',
  'Invalid or fake certificate',
  OTHER,
]

export const PH_REJECT_PAID = [
  'Not eligible for a special exam',
  'Details do not match records',
  OTHER,
]

// Program Head returning a request because of the parent's ID or selfie (first
// approval). Not a rejection: the parent verifies again and the request comes
// straight back to the Program Head — see returnForReverification.
export const PH_REVERIFY = [
  'Face does not match the ID',
  'Not the student’s parent or guardian',
  'Fake, edited or someone else’s ID',
  OTHER,
]

// Starts the progress-log line returnForReverification writes. The queues find
// a returned request (and the Program Head's reason) by it, so it must not change.
export const REVERIFY_LOG_PREFIX = 'Returned by Program Head for parent re-verification: '

// Program Head verifying the cashier receipt (paid, second approval).
export const PH_RECEIPT_REJECT = [
  'Blurred or unreadable receipt',
  'Not an official receipt',
  'Receipt details do not match',
  OTHER,
]
