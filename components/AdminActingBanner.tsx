import Link from 'next/link'

/**
 * Shown above a Registrar, Teacher or Program Head page when the admin opens it.
 * The admin sees and does exactly what that role does there; every step is
 * still logged with actor_role 'admin', so the history says who really did it.
 */
export default function AdminActingBanner({ asRole }: { asRole: string }) {
  return (
    <div
      className="mb-4 rounded-lg px-4 py-2.5 text-sm flex flex-wrap items-center justify-between gap-2"
      style={{ background: 'color-mix(in srgb, var(--sti-gold) 16%, transparent)', color: 'var(--card-foreground)' }}
    >
      <p>
        <strong>Admin view</strong> — you can do everything the {asRole} does on this page. What you do is recorded as
        done by Admin.
      </p>
      <Link href="/admin/requests" className="font-semibold underline underline-offset-2 whitespace-nowrap">
        Back to all requests
      </Link>
    </div>
  )
}
