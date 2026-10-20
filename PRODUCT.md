# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Students** of STI College Sta. Maria who missed a scheduled exam. Primary audience. Usually on a personal phone, often stressed and close to an exam deadline; most file a request once or twice a term.
- **Reviewing staff**, each with their own dashboard: Registrar, subject Teacher, Program Head.
- **Administrator**: accounts, school data (Excel import), exam periods, analytics; can act on any request.

## Product Purpose

EXAMFLOW is the special exam request system for STI College Sta. Maria. It replaces the paper special-exam form that a student carries in person from office to office for signatures.

Success: a request reaches a decision without the student walking it between offices, and the student always knows where it currently sits.

## Positioning

The approval route is enforced by the system, not by the student's physical presence. The request cannot skip a stage, every action is recorded, and the parent or guardian's identity is checked with a live face and ID verification compared against the Registrar's parent list (only the Program Head sees the comparison).

## Operating Context

The student's process, as built:

1. Log in with the school Microsoft account.
2. Fill the form: subject, then paid or excused. Excused requests need the document for the reason (Medical Certificate, Death Certificate, or another supporting document).
3. A parent or guardian verifies with a live face check and their ID; the ID name is compared with the Registrar's parent list (only the Program Head sees the result).
4. Press Submit. The request goes straight to the Teacher, who approves (the Teacher cannot reject); the Program Head accepts or rejects.
5. Excused: the exam is scheduled, the Registrar is not involved. Paid: the Registrar assesses the fee, the student pays the Cashier and uploads the receipt, the Program Head checks it, then the exam is scheduled.
6. The student also fills in the printed special-exam form from the Registrar's office, whether the exam is paid or waived. The Registrar counts exam takers from it, and the Cashier marks it when the student pays. Submitting online alone does not finish the request.

## Capabilities and Constraints

- Next.js 16 App Router, Supabase, Didit (identity verification), deployed on Vercel at examflow.me.
- Tertiary programs only.
- Undecided: whether student self sign-up stays (most students come from the admin's Excel import and log in with Microsoft).

## Brand Commitments

- Name: EXAMFLOW.
- STI navy `#002F6C` and STI gold `#FDB913` are required.

## Evidence on Hand

- No real statistics, testimonials, user counts or timing claims exist. Do not fabricate any.

## Product Principles

- Tell the truth about the process, including the inconvenient parts: the parent or guardian must be present with an ID, and the paper form is still required.
- A student should understand the whole route before logging in.
- Students first: plain language, phone-first.
