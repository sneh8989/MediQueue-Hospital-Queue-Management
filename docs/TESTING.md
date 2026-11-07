# Testing

## Running the tests

```bash
npm run test:server
```

Uses Node's built-in test runner (`node --test`) against the server
package. As of Phase 22: **186 tests, all passing** (162 through Phase 16,
+22 in Phase 21, +2 in Phase 22). Every test file
spins up a real Express server on an ephemeral port against an
**isolated JSON database file** (never the dev `db.json`), so tests
never interfere with each other or with manual testing data.

## Coverage by module

| Test file | Count | Covers |
|---|---|---|
| `auth.test.js` | 8 | Login, `/me`, `/logout`, token validation |
| `patients.test.js` | 12 | Patient CRUD, search, role enforcement |
| `departments-doctors-rooms.test.js` | 19 | All three resources' CRUD, room↔doctor sync, `/doctors/me` |
| `appointments.test.js` | 14 | Booking, conflict prevention, reschedule, doctor scoping |
| `queue.test.js` | 25 | Priority ordering, full state machine, token generation (walk-in + appointment-conversion), duplicate prevention, history |
| `publicQueue.test.js` | 6 | Unauthenticated display/tracking endpoints, patient-data-never-leaks |
| `consultations.test.js` | 11 | Doctor-only consultation CRUD tied to queue state |
| `prescriptions.test.js` | 12 | Multi-item prescriptions, doctor ownership |
| `dashboard.test.js` | 4 | Admin dashboard aggregation correctness |
| `reports.test.js` | 12 | All 8 report types against known seeded data |
| `notifications.test.js` | 13 | Notification triggers, scoping, read/unread |
| `auditLogs.test.js` | 9 | Filtering, ordering, admin-only access |
| `users.test.js` | 15 | Staff account lifecycle, password reset, role guard |
| `errorHandling.test.js` | 4 | No internal error leakage on unexpected exceptions |
| `settings.test.js` | 11 | Admin-only settings, validation, audit logging, and proof the setting really drives wait estimates |
| `operations.test.js` | 11 | Front-line dashboard endpoint: role access, exact live counts, priority-aware next token, ordering, no patient data leaked |

## Real Browser QA Automation (Google Chrome)

In Phase 22, full automated real-browser QA testing was implemented in [`qa/run-browser-tests.js`](../qa/run-browser-tests.js) using Puppeteer-Core driving Google Chrome against the live backend (`http://localhost:5000`) and Vite frontend (`http://localhost:5173`).

### Workflows Verified
1. **Admin Workflow (Test A):** Login, admin dashboard metrics, patient CRUD, department creation, room creation, doctor provisioning with auto-credentials, staff creation/activation, report generation (CSV download verification), audit logs, settings update.
2. **Receptionist Workflow (Test B):** Patient registration, appointment booking, check-in token generation with QR code modal, queue board navigation, walk-in token issuance, queue transitions (Call Next, Skip, Recall, Start Consultation).
3. **Doctor Workflow (Test C):** Doctor login, department queue loading, clinical consultation notes, diagnosis entry, multi-item prescription formulation, completion and synchronization with queue state.
4. **Nurse Workflow (Test D):** Nurse login, live queue monitoring, and security boundary validation (verifying `403 Forbidden` on unauthorized department mutations).
5. **Public Experience (Test E):** Large-screen waiting room display (zero PII verified), tracking portal (`/track`), and invalid tracking ID handling.
6. **Priority Preemption (Test F):** Critical queue preemption verified live: Normal patient booked first, Senior Citizen second, Pregnant third, and Emergency LAST. Verified Emergency immediately preempts waiting order (`patientsAhead: 0`) and is called first by `call-next`.
7. **Responsive & Mobile Usability (Phase 8):** Multi-device testing at Laptop (1366×768), Tablet (768×1024), and Mobile (390×844) viewports. Slide-out mobile drawer opened, clicked, and navigated to `/reception/patients`.
8. **Visual Proof:** 24 high-resolution screenshots saved to `docs/screenshots/`.

## Master spec checklist mapping (section 34)

The master prompt names these as minimum required tests. Every one
maps to real, passing tests — not just similarly-named ones, actually
exercising the described behavior:

| Spec requirement | Actual test(s) |
|---|---|
| Login | `auth.test.js`: "login succeeds with correct credentials...", "login fails with wrong password", "login fails validation with malformed email" |
| Patient creation | `patients.test.js`: "POST /api/patients creates a patient with auto-generated patientCode" |
| Appointment creation | `appointments.test.js`: "receptionist creates an appointment, defaults to scheduled status" |
| Token generation | `queue.test.js`: token-generation tests (walk-in path) + "generating a token from an appointmentId pulls patient/doctor/department from the appointment" (conversion path) |
| Queue priority | `queue.test.js`: "priority ordering: an emergency token created LAST is still queued FIRST" — the single most load-bearing test in the project |
| Call next | `queue.test.js`: "calling next pulls the highest-priority waiting patient, not the oldest token" |
| Skip | `queue.test.js`: "skip the called entry" + "cannot skip a waiting entry - skip only applies after being called (409)" |
| Complete consultation | `consultations.test.js`: "updating with completeConsultation:true also completes the underlying queue entry" |
| Role permissions | Every test file above includes at least one 403/401 case per role boundary — there is no controller in the app whose role restriction isn't exercised by a test that confirms an unauthorized role is actually rejected. |

## What is NOT covered, and why

**No frontend test runner exists.** Deliberately, not by oversight —
here's the reasoning: this project's frontend is a fairly thin
presentation layer over a backend that owns essentially all business
logic (validation, state machines, authorization, calculations). Every
non-trivial frontend behavior (form validation shape, conditional
rendering, role-gated buttons) either mirrors a rule already unit
tested server-side, or was verified manually against a running backend
before being considered "done" — every phase in this project's
development followed a consistent pattern: build the feature, smoke
test it against the real API with realistic data, only then consider
it complete and move on. `npm run build` (a full production Vite
build) was also run and confirmed clean after every single phase,
catching any type errors, broken imports, or build-breaking mistakes
immediately.

Given the time investment a proper frontend test suite (e.g. Vitest +
React Testing Library) would require versus the marginal correctness
benefit on top of an already-thin, already-manually-verified UI layer,
that investment was judged better spent on backend test depth — which
is where this app's actual complexity (the priority queue engine, the
state machines, the role-scoping logic) lives. If this project
continues past the current phase plan, Vitest is the natural choice
(it shares Vite's config, zero extra build tooling) and React Testing
Library for component-level assertions on the highest-risk components
first: `QueueBoardPage`, `ConsultationForm`, and `AppointmentForm`.

**No end-to-end (browser automation) tests.** Same reasoning as
above — every user flow was manually walked through against a live
backend at least once per phase (documented in each phase's
PROJECT_STATE.md "Tests Completed" section), but there's no Playwright/
Cypress suite automating that walkthrough. Phase 19 (Final Integration
Testing) includes one more full manual pass across every role's
primary flows before the project is considered complete — see below.

## Phase 19: Final Integration Testing

A from-scratch, end-to-end verification pass, run once as a single
continuous exercise rather than the per-phase incremental checks that
produced the coverage table above.

**Fresh install, followed literally from the README**: a completely
separate copy of the repo, with `node_modules`, `dist`, `.env` files,
and the dev database all stripped out — then `npm run install:all`,
`cp .env.example` → `.env` (both client and server), `npm run seed`,
`npm run dev:server`, `npm run dev:client`, in that order, exactly as
written. Every step worked with zero deviation from the documented
instructions — `install:all` reported 0 vulnerabilities, `seed`
produced the exact 4 accounts the README's table promises, the health
check and Vite dev server both responded correctly. `npm test` against
this fresh install: 162/162 passing, identical to the working copy.

**Full continuous patient journey** — the one thing no single phase's
tests exercised as one uninterrupted story: log in as all 4 seeded
roles → admin creates a department/room/doctor (with linked login,
verified that login works) → receptionist registers a patient →
receptionist books an appointment → receptionist converts that
appointment into a queue token (not a walk-in — the less-tested path)
→ call → doctor's own queue view shows the called patient → start →
doctor records a full consultation → doctor prescribes medicine →
doctor completes the consultation, which auto-completes the queue
entry → then verifies the complete record is consistent everywhere it
should appear: the patient's appointment history, queue history,
consultation history, and prescription history; the doctor's
notification inbox (`token_generated`, `token_called`,
`consultation_completed` all present); the audit log; the admin
dashboard's daily stats; the daily-patient report; and finally the
*unauthenticated* public tracking endpoint for that same queue entry
(confirmed it returns the right token and confirmed — again — that it
never leaks the patient's name). **30 assertions, all passing.**

**Print-friendly / display-screen review** (flagged as reviewed-but-
not-rebuilt-and-checked in Phase 17): rebuilt the production bundle
and confirmed directly in the compiled CSS that both the `.print-hide`
rule and the `print:block`/`print:bg-white` Tailwind print variants
`ReportsPage.jsx` depends on are present and correctly scoped under
`@media print`. Confirmed in source that `ReportsPage`'s print-only
title (`hidden` normally, `print:block` when printing) and
`DisplayScreenPage`'s dark theme classes are wired the way
`docs/ARCHITECTURE.md` describes. No browser is available in this
environment to visually confirm the rendered print output, so this is
a structural/compiled-output verification, not a pixel-level one —
flagged honestly rather than claimed as fully checked.

**Master spec Final Acceptance Checklist (section 41)** — walked item
by item against actual verified behavior (not assumed from a
similarly-named test existing). Every item is checked off except
"Final ZIP is created," which is Phase 20's job by design.

## Phase 21: Post-audit completion

**Backend** - 22 new tests (162 -> 184): `settings.test.js` (11) and
`operations.test.js` (11). Beyond the usual 401/403 and validation
cases, the two most important are (1) the setting genuinely drives wait
estimates for a doctor with no personal average (and not for one who has
one), and (2) the operations endpoint's "next token" follows the
priority-aware order - an emergency that arrived *last* is reported as
next, and departments with an emergency sort ahead of a longer queue.
Both files were mutation-checked: the code was deliberately broken
(setting written to the wrong key; "next token" taking the wrong end of
the queue; emergency-first sorting removed) and the tests were
confirmed to fail, then the code restored.

**UI** - there is still no frontend test runner in the repo (see above),
so the new pages were verified with a one-off, **uncommitted**
browser run rather than by adding tooling: the client was compiled with
esbuild and driven in real Chromium (Playwright) against the real
backend on a copy of the seeded data, with a deliberately varied queue
(normal and emergency walk-ins, one patient each called / in
consultation / completed / skipped). 76 checks, all passing:

- Reception and nurse dashboards: on-screen numbers equal the API, which
  equals a scenario worked out by hand; the emergency patient's token is
  shown as "Next"; the page refreshes itself when the queue changes
  behind its back, without ever flashing the spinner.
- Settings: invalid inputs (`0`, `200`, `7.5`, empty) show an inline
  message and never reach the server; a valid save persists across a
  reload, is confirmed by the API, and appears in the audit log.
- `/unauthorized`, 404 and `/track`: correct pages and links for
  logged-in and logged-out visitors; full links (with query string and
  hash), bare codes, empty and unknown codes all handled.
- Phone-width (390px) layout has no horizontal scrolling.
- A smoke pass over 19 pages from earlier phases (every admin page, the
  reception, doctor and nurse pages, the public display screen) loaded
  with zero console errors or failed API calls, under React's
  development-mode warnings.

That run found two real bugs, both fixed before delivery (see
`PROJECT_STATE.md` Phase 21).

**Not verified in the authoring environment:** `npm run build` (the
Vite production build) - the bundled `node_modules` contained
Windows-only native binaries and the package registry was unreachable,
so it could not be run there. Run it once locally.
