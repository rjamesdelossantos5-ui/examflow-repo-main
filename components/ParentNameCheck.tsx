import type { ParentCheck } from '@/lib/didit'
import { Icon, type IconName } from '@/components/Icon'

// The verdict line's icon and colour. The status colours are the AA-checked
// text tokens from globals.css, which flip to light tints in dark mode.
const TONE: Record<'good' | 'warn' | 'bad' | 'plain', { icon: IconName; color: string }> = {
  good: { icon: 'check', color: 'var(--status-success)' },
  warn: { icon: 'alert', color: 'var(--status-warning)' },
  bad: { icon: 'x-circle', color: 'var(--status-danger)' },
  plain: { icon: 'user', color: 'var(--muted)' },
}

/**
 * The name on the parent's ID next to the parents/guardians on the Registrar's
 * list, with a verdict (checkParentName in lib/didit.ts). Shown to the
 * Registrar and the Program Head. Advice only — they decide.
 *
 * A plain line with an icon, not a tinted box: colour marks only the verdict.
 */
export default function ParentNameCheck({ check }: { check: ParentCheck }) {
  const { result, idName, matched, onFile } = check
  const head =
    result === 'match' ? { tone: TONE.good, text: `Matches the ${matched?.relationship.toLowerCase() ?? 'parent'} on file` }
    : result === 'own' ? { tone: TONE.bad, text: 'Same name as the student. They may have verified as their own parent.' }
    : result === 'not_listed' ? { tone: TONE.warn, text: 'Not on the parent list' }
    : result === 'no_list' ? { tone: TONE.plain, text: 'No parent or guardian on file for this student' }
    : { tone: TONE.plain, text: 'No name read from the ID yet' }

  return (
    <div className="flex gap-2.5 text-sm">
      <Icon name={head.tone.icon} className="w-4 h-4 mt-0.5 shrink-0" style={{ color: head.tone.color }} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold" style={{ color: head.tone.color }}>{head.text}</p>
        {(idName || onFile.length > 0) && (
          // Label / value rows, so the names line up instead of running together.
          <dl className="mt-2 grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-1.5" style={{ color: 'var(--card-foreground)' }}>
            {idName && (
              <>
                <dt className="ef-muted">Name on the ID</dt>
                <dd className="font-semibold break-words">{idName}</dd>
              </>
            )}
            {onFile.length > 0 && (
              <>
                <dt className="ef-muted">On the list</dt>
                <dd className="space-y-0.5">
                  {onFile.map((p) => (
                    <div key={`${p.relationship}|${p.name}`} className={p.name === matched?.name && p.relationship === matched.relationship ? 'font-semibold' : ''}>
                      {p.name} <span className="ef-muted font-normal">· {p.relationship}</span>
                    </div>
                  ))}
                </dd>
              </>
            )}
          </dl>
        )}
        {result !== 'no_name' && (
          <p className="mt-2 text-xs ef-muted">Names on an ID can be written differently from the list. Compare them yourself before deciding.</p>
        )}
      </div>
    </div>
  )
}
