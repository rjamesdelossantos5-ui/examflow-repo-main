import type { ParentCheck } from '@/lib/didit'

const TONE = {
  good: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-500/10 dark:border-green-500/30 dark:text-green-200',
  warn: 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-100',
  bad: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-200',
  plain: 'ef-border',
} as const

/**
 * The name on the parent's ID next to the parents/guardians on the Registrar's
 * list, with a verdict (checkParentName in lib/didit.ts). Shown to the
 * Registrar and the Program Head. Advice only — they decide.
 */
export default function ParentNameCheck({ check }: { check: ParentCheck }) {
  const { result, idName, matched, onFile } = check
  const head =
    result === 'match' ? { tone: TONE.good, text: `✓ Matches the ${matched?.relationship.toLowerCase() ?? 'parent'} on file` }
    : result === 'own' ? { tone: TONE.bad, text: '⚠ Same name as the student — they may have verified as their own parent' }
    : result === 'not_listed' ? { tone: TONE.warn, text: '⚠ Not on the parent list' }
    : result === 'no_list' ? { tone: TONE.plain, text: 'No parent or guardian on file for this student' }
    : { tone: TONE.plain, text: 'No name read from the ID yet' }

  return (
    <div className={`rounded-lg border px-3 py-2.5 text-sm ${head.tone}`}>
      <p className="font-semibold">{head.text}</p>
      {idName && (
        <p className="mt-1 text-xs">
          Name on the ID: <strong>{idName}</strong>
        </p>
      )}
      {onFile.length > 0 && (
        <div className="mt-1.5 text-xs">
          <p className="opacity-80">On the Registrar&apos;s list:</p>
          <ul className="mt-0.5 space-y-0.5">
            {onFile.map((p) => (
              <li key={`${p.relationship}|${p.name}`} className={p.name === matched?.name && p.relationship === matched.relationship ? 'font-semibold' : ''}>
                {p.relationship} — {p.name}
              </li>
            ))}
          </ul>
        </div>
      )}
      {result !== 'no_name' && (
        <p className="mt-1.5 text-2xs opacity-75">
          Names read off an ID can be written differently from the list — compare them yourself before deciding.
        </p>
      )}
    </div>
  )
}
