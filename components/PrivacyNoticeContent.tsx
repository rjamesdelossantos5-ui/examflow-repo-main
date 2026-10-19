/*
 * The Privacy Notice text, shared by the /privacy page and the pop-up on the
 * submit form so the two can never disagree. Colours come from the wrapper as
 * --pn-ink (headings, bold), --pn-soft (body) and --pn-rule (hairlines): the
 * page sets its fixed light palette, the pop-up uses the app theme. Layout uses
 * container queries, so the same rows are two columns on the wide page and
 * stacked in the narrow pop-up.
 */

function Section({ as: H, title, children }: { as: 'h2' | 'h3'; title: string; children: React.ReactNode }) {
  return (
    <section className="grid @3xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-16 gap-y-3 py-8 @3xl:py-12" style={{ borderTop: '1px solid var(--pn-rule)' }}>
      <H className="text-lg @3xl:text-2xl font-extrabold leading-tight text-balance" style={{ fontStretch: '115%', letterSpacing: '-0.01em' }}>
        {title}
      </H>
      <div className="text-base leading-relaxed space-y-4 max-w-[68ch]" style={{ color: 'var(--pn-soft)' }}>{children}</div>
    </section>
  )
}

/** Bold term, then its text. */
function Item({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-bold" style={{ color: 'var(--pn-ink)' }}>{term}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  )
}

function B({ children }: { children: React.ReactNode }) {
  return <strong className="font-bold" style={{ color: 'var(--pn-ink)' }}>{children}</strong>
}

// Matches what each role's screens show (RegistrarQueue/TeacherQueue pass
// showDocuments={false}; only PHQueue shows documents and the Didit photos).
const ACCESS = [
  { who: 'You', what: <>only your own requests.</> },
  { who: 'Registrar', what: <>your details and form, and the result of the parent or guardian check, including the name on the ID and how it compares with the parent list. Not your documents.</> },
  { who: 'Subject teacher', what: <>only requests for subjects they teach. Teachers <em>cannot</em> see your documents or the parent or guardian check.</> },
  { who: 'Program head', what: <>requests for their department&apos;s subjects at their approval stage, including your supporting document, your receipt, and the parent or guardian&apos;s ID and face photos.</> },
  { who: 'Administrator', what: <>every request, with the same view as any of the roles above, plus account management, statistics and sign-in records.</> },
]

// Outside services that run parts of EXAMFLOW.
const SERVICES = [
  { who: 'Didit', what: <>runs the parent or guardian&apos;s face and ID check and holds those photos. Didit&apos;s documentation says it stores data in the European Union by default.</> },
  { who: 'Supabase', what: <>hosts the database and the uploaded files.</> },
  { who: 'Vercel', what: <>hosts the website.</> },
  { who: 'Google (Gmail)', what: <>sends the email updates about a request. These contain your name, student number, the subject, the reason given and the request&apos;s status.</> },
]

function Rows({ rows }: { rows: { who: string; what: React.ReactNode }[] }) {
  return (
    <dl style={{ borderTop: '2px solid var(--pn-ink)' }}>
      {rows.map((a) => (
        <div key={a.who} className="grid sm:grid-cols-[10rem_minmax(0,1fr)] gap-x-6 gap-y-1 py-3" style={{ borderBottom: '1px solid var(--pn-rule)' }}>
          <dt className="font-bold" style={{ color: 'var(--pn-ink)' }}>{a.who}</dt>
          <dd>{a.what}</dd>
        </div>
      ))}
    </dl>
  )
}

const RIGHTS = [
  'Be informed about what is collected and why — this notice.',
  'Access the information held about you.',
  'Correct anything that is inaccurate.',
  'Object to processing, or withdraw your consent.',
  'Request erasure of your information.',
  'Complain to the National Privacy Commission.',
]

export default function PrivacyNoticeContent({ heading = 'h2' }: { heading?: 'h2' | 'h3' }) {
  return (
    <div className="@container [&>section:first-child]:border-t-0">
      <Section as={heading} title="Who is responsible">
        <p>
          EXAMFLOW is the special exam request system of STI College Sta. Maria. The school is the
          personal information controller for the data described below.
        </p>
      </Section>

      <Section as={heading} title="What we collect">
        <dl className="space-y-4">
          <Item term="About the student">
            full name, student number, course, year level, section, contact number, and school email address.
          </Item>
          <Item term="About the request">
            the subject, the exam type (paid or waived), the reason given, and the review history — including who
            approved or rejected it, when, and why.
          </Item>
          <Item term="Documents you upload">
            a supporting document for a waived exam (for example, a medical or death certificate), and the
            official receipt for a paid exam.
          </Item>
          <Item term="The parent or guardian check">
            before a request is sent, your parent or guardian takes a live face check and photographs their ID
            through Didit, an identity verification service. EXAMFLOW keeps the result: the name read from the ID,
            the type of ID, the face match and liveness scores, and any warnings. The photos stay with Didit;
            EXAMFLOW does not store them.
          </Item>
          <Item term="The parent list">
            the Registrar&apos;s list of each student&apos;s father, mother or guardian (names and relationship),
            used to compare with the name on the ID.
          </Item>
          <Item term="Sign-in records">
            each time you sign in, your name, email address, role, how you signed in, and the date and time. Nothing
            else is recorded — not your location, IP address or device.
          </Item>
        </dl>
        <p>
          Government-issued IDs and health records such as medical certificates are <B>sensitive personal
          information</B> under the law. They are collected only with your consent, which you give on the
          submission form.
        </p>
      </Section>

      <Section as={heading} title="Why we collect it">
        <p>
          Solely to receive, verify, approve or reject, and schedule special exam requests. The parent or guardian
          check exists to confirm that a parent or guardian genuinely authorised the request. Sign-in records exist
          to keep accounts secure — for example, to check whether an account was used by someone else. Your
          information is not used for advertising and is not sold. Outside the school, it goes only to the services
          listed below, which run parts of EXAMFLOW.
        </p>
      </Section>

      <Section as={heading} title="Who can see it">
        <p>Each role sees only what its step needs:</p>
        <Rows rows={ACCESS} />
      </Section>

      <Section as={heading} title="Services we use">
        <Rows rows={SERVICES} />
      </Section>

      <Section as={heading} title="How long we keep it">
        {/* Deletion runs in lib/purgeExpiredExams.ts, on page load of the PH
            and admin request lists; Didit sessions are deleted only in
            lib/purgeExpiredExams.ts and deleteFinishedRequest (and on return, in
            app/program-head/actions.ts). */}
        <p>
          Approved and scheduled requests, together with every document uploaded for them, are <B>permanently
          deleted from the day after the exam date</B>. This happens automatically, the next time a Program Head or
          the administrator opens the list of requests.
        </p>
        <p>
          Requests that never reach the exam are not deleted automatically. You can remove one yourself while it is
          pending or after it is rejected.
        </p>
        <p>
          The parent or guardian&apos;s ID and face photos are kept at Didit for the term, so one check can cover every
          request you file that term and the Program Head can compare them. EXAMFLOW asks Didit to <B>delete them
          when the term&apos;s requests are deleted</B> (the day after the exam), or straight away if the Program Head
          sends the request back for a new check. If a request is rejected or removed before then, the photos
          stay with Didit under Didit&apos;s own retention settings.
        </p>
        <p>
          Anonymised counts (how many students took a special exam, by department, subject and term) are kept for
          reporting. These contain no names, student numbers, or documents, and cannot be traced back to any
          individual.
        </p>
        <p>
          Sign-in records are <B>deleted automatically after 90 days</B>.
        </p>
      </Section>

      <Section as={heading} title="How it is protected">
        <p>
          Data is transmitted over an encrypted connection. Request records are protected by access rules for each
          role in the database. Uploaded files are opened only through links that expire after a few minutes.
        </p>
      </Section>

      <Section as={heading} title="Your rights">
        <p>Under RA 10173 you have the right to:</p>
        <ul className="list-disc pl-5 space-y-1.5 marker:text-[var(--pn-ink)]">
          {RIGHTS.map((r) => <li key={r}>{r}</li>)}
        </ul>
        <p>You may also delete a pending or rejected request yourself, from the request page.</p>
      </Section>

      <Section as={heading} title="A note for parents and guardians">
        <p>
          The ID and face check belong to your parent or guardian, not to you. Before submitting, you must confirm
          that they know about and have authorised the request. Please show them this notice.
        </p>
      </Section>

      <Section as={heading} title="Contact">
        <p>
          To exercise any of the rights above, or to ask a question about this notice, contact the STI College Sta.
          Maria Registrar&apos;s Office or your Program Head.
        </p>
      </Section>
    </div>
  )
}
