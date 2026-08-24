import Link from 'next/link'

export const metadata = { title: 'EXAMFLOW — Privacy Notice' }

/**
 * Privacy Notice, required because EXAMFLOW collects SENSITIVE personal
 * information under the Data Privacy Act of 2012 (RA 10173) — government-issued
 * IDs, signatures, and (for medical excuses) health documents. Sensitive
 * personal information may generally only be processed with consent given
 * BEFORE processing and specific to the purpose, which is why the submit form
 * carries its own declaration rather than relying on a blanket sign-up tick.
 *
 * Public route (no auth) so it can be linked from the login page — a person
 * must be able to read what will be collected before they hand anything over.
 */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="text-lg font-bold" style={{ color: 'var(--card-foreground)' }}>{title}</h2>
      <div className="mt-2 text-sm ef-muted space-y-2">{children}</div>
    </section>
  )
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen px-4 py-10" style={{ background: 'var(--background)' }}>
      <div className="max-w-2xl mx-auto ef-card rounded-2xl shadow-sm p-6 sm:p-8">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--card-foreground)' }}>Privacy Notice</h1>
        <p className="text-sm ef-muted mt-1">
          How EXAMFLOW collects and handles your information, under the Data Privacy Act of 2012 (RA 10173).
        </p>

        <Section title="Who is responsible">
          <p>
            EXAMFLOW is the special exam request system of STI College Sta. Maria. The school is the
            personal information controller for the data described below.
          </p>
        </Section>

        <Section title="What we collect">
          <p><strong style={{ color: 'var(--card-foreground)' }}>About the student:</strong> full name,
            student number, course, year level, section, contact number, and school email address.</p>
          <p><strong style={{ color: 'var(--card-foreground)' }}>About the request:</strong> the subject,
            the exam type (paid or excused), the reason given, and the review history — including who
            approved or rejected it and when.</p>
          <p><strong style={{ color: 'var(--card-foreground)' }}>Documents you upload:</strong> the front
            and back of a parent or guardian&apos;s valid ID, the parent or guardian&apos;s signature, a
            payment receipt for paid exams, and a supporting document for excused exams (for example, a
            medical certificate).</p>
          <p>
            Government-issued IDs, signatures, and health records such as medical certificates are
            <strong style={{ color: 'var(--card-foreground)' }}> sensitive personal information</strong> under
            the law. They are collected only with your consent, which you give on the submission form.
          </p>
        </Section>

        <Section title="Why we collect it">
          <p>
            Solely to receive, verify, approve or reject, and schedule special exam requests. Identity
            documents exist to confirm that a parent or guardian genuinely authorised the request.
            Your information is not used for advertising, and it is not sold or shared with anyone
            outside the school.
          </p>
        </Section>

        <Section title="Who can see it">
          <p>
            Access is limited by role, and enforced by the database itself rather than by the screens
            you see:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong style={{ color: 'var(--card-foreground)' }}>You</strong> — only your own requests.</li>
            <li><strong style={{ color: 'var(--card-foreground)' }}>Registrar</strong> — requests under review, including uploaded documents.</li>
            <li><strong style={{ color: 'var(--card-foreground)' }}>Subject teacher</strong> — only requests for subjects they teach. Teachers <em>cannot</em> view uploaded documents.</li>
            <li><strong style={{ color: 'var(--card-foreground)' }}>Program head</strong> — requests in their approval stage, including receipts.</li>
            <li><strong style={{ color: 'var(--card-foreground)' }}>Administrator</strong> — account management and anonymised statistics.</li>
          </ul>
        </Section>

        <Section title="How long we keep it">
          <p>
            Approved and scheduled requests, together with every document uploaded for them, are
            <strong style={{ color: 'var(--card-foreground)' }}> permanently deleted about one day after the exam date</strong>.
            Deletion is automatic — no one has to remember to do it.
          </p>
          <p>
            Anonymised counts (how many students took a special exam, by department, subject and term)
            are kept for reporting. These contain no names, student numbers, or documents, and cannot
            be traced back to any individual.
          </p>
        </Section>

        <Section title="How it is protected">
          <p>
            Data is transmitted over an encrypted connection and stored with access rules applied at the
            database level, so a person can only read or change the records their role permits. Uploaded
            files are kept in private storage and are never publicly accessible by link.
          </p>
        </Section>

        <Section title="Your rights">
          <p>Under RA 10173 you have the right to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Be informed about what is collected and why — this notice.</li>
            <li>Access the information held about you.</li>
            <li>Correct anything that is inaccurate.</li>
            <li>Object to processing, or withdraw your consent.</li>
            <li>Request erasure of your information.</li>
            <li>Complain to the National Privacy Commission.</li>
          </ul>
          <p className="pt-1">
            You may also delete a pending or rejected request yourself, from the request page.
          </p>
        </Section>

        <Section title="A note on parent and guardian documents">
          <p>
            A parent or guardian&apos;s ID and signature belong to <em>them</em>, not to the student
            uploading them. Before submitting, you must confirm that your parent or guardian knows about
            and has authorised the request. Please show them this notice.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            To exercise any of the rights above, or to ask a question about this notice, contact the STI
            College Sta. Maria Registrar&apos;s Office or your Program Head.
          </p>
        </Section>

        <div className="mt-8 pt-5 border-t ef-border flex flex-wrap gap-4 items-center">
          <Link href="/login" className="ef-press px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}>
            Back to Login
          </Link>
          <Link href="/" className="text-sm ef-muted hover:underline">Home</Link>
        </div>
      </div>
    </main>
  )
}
