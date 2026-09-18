/**
 * Special-exam fees.
 *
 * The ₱200 used to live as literal text inside ReceiptUpload.tsx, which meant
 * the Registrar's payment-assessment tab and the student's receipt instructions
 * could quietly disagree about the amount. It is one constant now.
 *
 * NOTE: this is a flat per-subject fee. If the school ever charges different
 * amounts per subject or per course, this is the wrong shape and the Registrar
 * should be entering the total by hand instead.
 */
export const SPECIAL_EXAM_FEE = 200

/** ₱1,200 — grouped thousands, no decimals, since the fee is always whole pesos. */
export function formatPeso(amount: number): string {
  return `₱${amount.toLocaleString('en-PH')}`
}

/** What a student owes for `count` accepted paid subjects. */
export function totalFee(count: number): number {
  return count * SPECIAL_EXAM_FEE
}
