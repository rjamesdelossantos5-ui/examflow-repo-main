/*
 * Privacy Notice — same world as the landing page (app/page.tsx): navy bar,
 * cool off-white then white paper, navy ink, hairline rules, Archivo. No card:
 * the notice is a document, so it reads like one. Each section is a row with
 * its heading on the left and the text on the right (stacked on phones).
 *
 * Required because EXAMFLOW collects SENSITIVE personal information under the
 * Data Privacy Act of 2012 (RA 10173) — government-issued IDs and (for medical
 * excuses) health documents. Sensitive personal information may generally only
 * be processed with consent given BEFORE processing and specific to the
 * purpose, which is why the submit form carries its own declaration rather than
 * relying on a blanket sign-up tick.
 *
 * Public route (no auth) so a person can read what will be collected before
 * they hand anything over.
 */
import Link from 'next/link'
import { archivo } from '../fonts'

export const metadata = { title: 'EXAMFLOW — Privacy Notice' }

const NAVY = '#002F6C'
const GOLD = '#FDB913'
const INK_SOFT = '#3D4F6E'
const RULE = '#D5DCE6'
const PAPER_COOL = '#F5F7FA'
const CONTAINER = 'max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-16 gap-y-3 py-10 lg:py-12" style={{ borderTop: `1px solid ${RULE}` }}>
      <h2 className="text-xl lg:text-2xl font-extrabold leading-tight text-balance" style={{ fontStretch: '115%', letterSpacing: '-0.01em' }}>
        {title}
      </h2>
      <div className="text-base leading-relaxed space-y-4 max-w-[68ch]" style={{ color: INK_SOFT }}>{children}</div>
    </section>
  )
}

/** Bold term, then its text. */
function Item({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-bold" style={{ color: NAVY }}>{term}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  )
}

function B({ children }: { children: React.ReactNode }) {
  return <strong className="font-bold" style={{ color: NAVY }}>{children}</strong>
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
    <dl style={{ borderTop: `2px solid ${NAVY}` }}>
      {rows.map((a) => (
        <div key={a.who} className="grid sm:grid-cols-[10rem_minmax(0,1fr)] gap-x-6 gap-y-1 py-3" style={{ borderBottom: `1px solid ${RULE}` }}>
          <dt className="font-bold" style={{ color: NAVY }}>{a.who}</dt>
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

export default function PrivacyPage() {
  // Inline colours, like the landing page, so the app's dark-mode overrides
  // never touch this public page.
  return (
    <div className={`${archivo.variable} ef-landing min-h-screen`} style={{ background: '#FFFFFF', color: NAVY, fontFamily: 'var(--font-archivo), Arial, sans-serif' }}>
      <header style={{ background: NAVY, color: '#FFFFFF' }}>
        <div className={`${CONTAINER} h-16 flex items-center`}>
          <Link href="/" className="font-black text-lg leading-none" style={{ fontStretch: '115%' }} aria-label="EXAMFLOW home">
            EXAM<span style={{ color: GOLD }}>FLOW</span>
          </Link>
        </div>
      </header>

      <section style={{ background: PAPER_COOL }}>
        <div className={`${CONTAINER} pt-16 pb-14 lg:pt-24 lg:pb-20`}>
          <h1
            className="ef-reveal font-extrabold leading-[0.98] text-balance"
            style={{ fontStretch: '125%', fontSize: 'clamp(2.2rem, 4.4vw, 3.5rem)', letterSpacing: '-0.03em', marginLeft: '-0.03em' }}
          >
            Privacy Notice
          </h1>
          <p className="ef-reveal mt-5 text-lg leading-relaxed max-w-[52ch]" style={{ color: INK_SOFT, animationDelay: '90ms' }}>
            How EXAMFLOW collects and handles your information, under the Data Privacy Act of 2012 (RA 10173).
          </p>
        </div>
      </section>

      <main className={`${CONTAINER} pb-16`} style={{ borderTop: `1px solid ${RULE}` }}>
        {/* First rule comes from <main>'s border, so the first row skips its own */}
        <div className="[&>section:first-child]:border-t-0">
          <Section title="Who is responsible">
            <p>
              EXAMFLOW is the special exam request system of STI College Sta. Maria. The school is the
              personal information controller for the data described below.
            </p>
          </Section>

          <Section title="What we collect">
            <dl className="space-y-4">
              <Item term="About the student">
                full name, student number, course, year level, section, contact number, and school email address.
              </Item>
              <Item term="About the request">
                the subject, the exam type (paid or excused), the reason given, and the review history — including who
                approved or rejected it, when, and why.
              </Item>
              <Item term="Documents you upload">
                a supporting document for an excused exam (for example, a medical or death certificate), and the
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

          <Section title="Why we collect it">
            <p>
              Solely to receive, verify, approve or reject, and schedule special exam requests. The parent or guardian
              check exists to confirm that a parent or guardian genuinely authorised the request. Sign-in records exist
              to keep accounts secure — for example, to check whether an account was used by someone else. Your
              information is not used for advertising and is not sold. Outside the school, it goes only to the services
              listed below, which run parts of EXAMFLOW.
            </p>
          </Section>

          <Section title="Who can see it">
            <p>Each role sees only what its step needs:</p>
            <Rows rows={ACCESS} />
          </Section>

          <Section title="Services we use">
            <Rows rows={SERVICES} />
          </Section>

          <Section title="How long we keep it">
            {/* Deletion runs in lib/purgeExpiredExams.ts, on page load of the PH
                and admin request lists; Didit sessions are deleted only in
                app/program-head/actions.ts (accept / return). */}
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
              EXAMFLOW asks Didit to <B>delete the parent or guardian&apos;s photos</B> as soon as the Program Head
              accepts the request or sends it back for a new check. If a request is rejected or removed before that,
              the photos stay with Didit under Didit&apos;s own retention settings.
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

          <Section title="How it is protected">
            <p>
              Data is transmitted over an encrypted connection. Request records are protected by access rules for each
              role in the database. Uploaded files are opened only through links that expire after a few minutes.
            </p>
          </Section>

          <Section title="Your rights">
            <p>Under RA 10173 you have the right to:</p>
            <ul className="list-disc pl-5 space-y-1.5 marker:text-[#002F6C]">
              {RIGHTS.map((r) => <li key={r}>{r}</li>)}
            </ul>
            <p>You may also delete a pending or rejected request yourself, from the request page.</p>
          </Section>

          <Section title="A note for parents and guardians">
            <p>
              The ID and face check belong to your parent or guardian, not to you. Before submitting, you must confirm
              that they know about and have authorised the request. Please show them this notice.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              To exercise any of the rights above, or to ask a question about this notice, contact the STI College Sta.
              Maria Registrar&apos;s Office or your Program Head.
            </p>
          </Section>
        </div>
      </main>

      <footer style={{ borderTop: `1px solid ${RULE}` }}>
        <div className={`${CONTAINER} h-16 flex items-center justify-center`}>
          <Link href="/" className="font-black text-lg leading-none" style={{ fontStretch: '115%' }}>
            EXAM<span style={{ color: GOLD }}>FLOW</span>
          </Link>
        </div>
      </footer>
    </div>
  )
}
