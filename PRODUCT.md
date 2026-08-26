# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two primary audiences, each owning a different surface. Neither is subordinate to the other.

- **Students** — own the submit-and-track experience. Largest group, lowest frequency: most file a request once or twice a term, often under time pressure near an exam window, predominantly on personal phones over mobile data.
- **Reviewing staff** — own the review queues. Small group, high frequency, repeated every term:
  - **Registrar** — first reviewer. Verifies submitted details and the uploaded parent documents.
  - **Subject Teacher** — second reviewer. Approves requests for subjects they teach.
  - **Program Head** — final approver. Accepts or rejects, verifies payment receipts, and sets the exam period and schedule.
- **Administrator** — manages the system rather than exam requests: accounts, departments, subjects, override authorisations, and statistics.

## Product Purpose

EXAMFLOW is the special exam request system for STI College Sta. Maria. A student who missed a scheduled exam files a request, attaches parent/guardian authorisation, and is routed through a fixed three-stage approval to a scheduled special exam.

It replaces a **paper form carried in person** between the registrar, the subject teacher, and the program head for signatures. Success is a request that reaches a decision without the student physically walking it between offices, and without a reviewer being the reason it stalls.

## Positioning

The approval chain is enforced by the system rather than by the student's physical presence. A paper form advances only as fast as the student can find each signatory in their office; EXAMFLOW routes the request to whoever is next, records who acted and when, and shows the student where it currently sits.

Two consequences a paper process cannot offer: the request cannot skip a stage or be approved out of order, and the student always knows the current status without asking anyone.

## Operating Context

- **The approval chain is sequential and fixed:** submitted → verified by Registrar → approved by Subject Teacher → accepted by Program Head. A rejection at any stage returns the request to the student, who may edit and resubmit; a resubmission returns to the reviewer who rejected it, unless the subject, exam type, or section changed, in which case it restarts.
- **Two exam types with different endings.** *Excused* requests (medical, bereavement, other — with a supporting document) go straight to scheduled on approval. *Paid* requests require the student to upload a payment receipt, which the Program Head verifies as a second approval before scheduling. Payment happens offline; the system only handles proof of it.
- **Requests are bound to an exam period** — a term (prelim, midterms, prefinals, finals) within a semester and school year. The Program Head sets the submission window and the exam date; submissions are refused outside that window.
- **Parent/guardian authorisation is the point of the uploads.** Front and back of a valid ID plus a signature. The registrar checks these; subject teachers deliberately cannot see them.
- **Accounts are provisioned by the administrator.** There is no self-registration. Departments and subjects are managed centrally, with subjects importable from the school's semester Excel.
- **Staff work on shared campus computers as well as personal devices**, which affects assumptions about sessions and sign-in.

## Capabilities and Constraints

**Confirmed functionality**
- Role-based access for five roles, enforced in the database by row-level security rather than only in the interface.
- Per-request snapshot of the student's details at submission time, so later profile edits don't retroactively change older requests.
- Full audit trail: every action records the actor, their role, and a timestamp.
- Program Head override path — with administrator authorisation — to accept a request whose earlier reviewers have not acted (absence, leave).
- Bulk Excel import for subjects.

**Durable constraints**
- **Mobile performance on low-end Android is a hard constraint, not a preference.** The student surface must stay usable on entry-level phones over mobile data. Performance regressions here have been treated as defects.
- **Automatic deletion:** approved and scheduled requests, and every document uploaded for them, are permanently deleted roughly one day after the exam date. Only anonymised counts survive, for reporting. Any feature that assumes long-lived request data is incompatible with this.
- **Philippine Data Privacy Act (RA 10173).** Parent IDs, signatures, and medical certificates are sensitive personal information. Consent is captured at the point of submission and recorded in the audit trail; a public privacy notice is reachable without signing in.
- The parent or guardian is a data subject but never a system user — they never hold an account.

**Explicitly undecided / not built**
- **Microsoft 365 single sign-on** — requested from STI IT; blocked on tenant administrator approval, which student accounts do not have. Not built.
- **Email notification to reviewers** — deferred by decision, not by difficulty.
- **Self-service password change or reset** — does not exist for any role. May be made moot by SSO.
- **Parent face verification (selfie matched to ID)** — explored and deliberately reverted. A media type for it exists in the schema, unused.
- **Per-program semester tracks** — programs in the same department can run on different semester cycles. Deliberately deferred; the current model is one school-wide semester.
- **Importing the school's real class-schedule Excel** — the live file's shape (instructor surnames, no emails, no department column, multiple sheets) does not match what the importer expects. Unresolved.

## Brand Commitments

- **STI College Sta. Maria.** The system is institutional, not a personal or commercial product.
- **STI gold `#FDB913` and STI navy `#002F6C`** are established brand colours already carried through the interface.
- Light and dark themes are both supported and must stay in parity.

## Evidence on Hand

- `public/CLASS-SCHEDULE_CAPSTONE-2026 (1).xlsx` — the school's real class schedule: 3 sheets, 519 rows on the tertiary sheet, 125 course codes, 63 sections, 60 instructors identified by surname only.
- `supabase/schema.sql` and ~27 migration files — the authoritative data model and access policies.
- `supabase/seed_test_accounts.sql` — curated test data (departments, subjects, teachers, program heads, students, class offerings).

**Absences future work must not fabricate:** there are no real user testimonials, no usage metrics, no pilot results, and no deployment history. The system has not yet run in production.

## Product Principles

1. **The database is the security boundary.** Any rule enforced only in the interface is a convenience, not a guarantee. Access rules belong in row-level policies where they hold regardless of how a request arrives.
2. **A student must never be blocked from requesting an exam by a system judgement.** Automated checks may flag for human review; they may not reject on their own. A false rejection costs a student an exam.
3. **Collect the minimum, delete it on schedule.** Sensitive documents exist only as long as the approval they support.
4. **The phone is the student's real device.** Weight added to the student surface is weight on an entry-level Android over mobile data.
5. **No reviewer's absence may strand a request.** The chain is fixed, but it has an authorised way around a missing person.

## Accessibility & Inclusion

- **WCAG AA contrast is an established, measured commitment.** Text colour tokens were computed against their actual backgrounds and corrected where they fell short; the values and their ratios are documented in the stylesheet.
- Status must never be conveyed by colour alone — every state carries a label or icon as well.
- `prefers-reduced-motion` is honoured.
- Keyboard focus must stay visible on every interactive control.
