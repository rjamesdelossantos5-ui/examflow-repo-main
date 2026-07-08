// Shared input validators used by the submit / profile / admin forms.
//
// Client components use these for instant feedback, and every server action
// re-checks them — the SERVER is the real guard, because HTML/JS validation can
// be bypassed (a crafted POST is how free-text garbage like "asdf!@#" gets in).

// Philippine mobile number. Ignores common spacing/punctuation, then requires
// the canonical shape: 09XXXXXXXXX (11 digits) or +639XXXXXXXXX / 639XXXXXXXXX.
export function isValidPhone(v: string): boolean {
  const compact = v.replace(/[\s().\-]/g, '')
  return /^(09\d{9}|\+?639\d{9})$/.test(compact)
}

// Student number: digits with optional dashes (e.g. "2024-00001", "02000123456").
// No letters or symbols; 4–15 digits total.
export function isValidStudentNumber(v: string): boolean {
  if (!/^[0-9-]+$/.test(v)) return false
  const digits = v.replace(/\D/g, '')
  return digits.length >= 4 && digits.length <= 15
}

// A person's name: letters (incl. accents), spaces and . ' - only. Must contain
// a letter and no digits — lenient enough for real names, strict enough to
// reject "asdf123" / "!@#$".
export function isValidName(v: string): boolean {
  return v.length >= 2 && /\p{L}/u.test(v) && /^[\p{L}\s.'-]+$/u.test(v)
}

// Course / section codes: letters, digits, spaces, & and - (e.g. "BSIT",
// "STEM 11-A"). Rejects punctuation/symbol soup.
export function isValidCode(v: string): boolean {
  return /^[\p{L}\p{N}\s&-]+$/u.test(v)
}

// Basic email shape (Supabase does the authoritative check on create).
export function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}
