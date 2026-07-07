// Preset rejection reasons per reviewer + context. Each list ends with 'Other',
// which reveals a free-text box in the picker. Kept here so the wording stays
// consistent everywhere it's shown.

export const OTHER = 'Other'

// Registrar verifies identity documents (ID front/back + parent signature).
// They do NOT see the medical/death certificate, so their reasons are about
// those identity docs and the form details — not the excuse certificate.
export const REGISTRAR_REJECT = [
  'Blurred or unreadable ID',
  'Invalid or expired ID',
  'Missing or invalid parent signature',
  'Incomplete or wrong student details',
  'Wrong document uploaded',
  OTHER,
]

// Teacher approves the subject / validity of the absence — not the paperwork.
export const TEACHER_REJECT = [
  'Not enrolled in this subject',
  'Absence not valid for a special exam',
  'Insufficient justification',
  'Already took the exam',
  OTHER,
]

// Program Head reviews the excuse certificate (medical / death cert) for an
// excused request, so certificate-related reasons live here.
export const PH_REJECT_EXCUSED = [
  'Blurred or unreadable certificate (medical / death)',
  'Invalid or fake certificate',
  'Certificate does not match the reason',
  'Wrong document uploaded',
  OTHER,
]

export const PH_REJECT_PAID = [
  'Incomplete requirements',
  'Not eligible for a special exam',
  'Details do not match records',
  OTHER,
]

// Program Head verifying the cashier receipt (paid, second approval).
export const PH_RECEIPT_REJECT = [
  'Blurred or unreadable receipt',
  'Wrong amount paid',
  'Not an official receipt',
  'Receipt details do not match',
  OTHER,
]
