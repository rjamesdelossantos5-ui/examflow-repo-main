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
      <div className="min-w-0 space-y-1">
        <p className="font-semibold" style={{ color: head.tone.color }}>{head.text}</p>
        {idName && (
          <p style={{ color: 'var(--card-foreground)' }}>
            <span className="ef-muted">Name on the ID:</span> <strong>{idName}</strong>
          </p>
        )}
        {onFile.length > 0 && (
          <p style={{ color: 'var(--card-foreground)' }}>
            <span className="ef-muted">On the list:</span>{' '}
            {onFile.map((p, i) => (
              <span key={`${p.relationship}|${p.name}`}>
                {i > 0 && <span className="ef-muted">; </span>}
                <span className={p.name === matched?.name && p.relationship === matched.relationship ? 'font-semibold' : ''}>
                  {p.relationship} {p.name}
                </span>
              </span>
            ))}
          </p>
        )}
        {result !== 'no_name' && (
          <p className="text-xs ef-muted">Names on an ID can be written differently from the list. Compare them yourself before deciding.</p>
        )}
      </div>
    </div>
  )
}
