# Architecture

_Updated incrementally as each phase added new modules — sections
below are labeled with the phase that introduced them. Current as of
Phase 18._

## Overview

Two independent apps in one repo:

- **client/** — React SPA (Vite). Talks to the backend only through
  `src/services/api.js` (a single Axios instance). No component ever
  calls `fetch`/`axios` directly.
- **server/** — Express REST API. Layered as
  `routes -> controllers -> services -> models`, with `models` as the
  only layer that touches the persistence layer.

## Data flow

```
React component
  -> service function (src/services/*.js)      [Phase 3+]
    -> api.js (axios instance, attaches JWT)
      -> Express route
        -> middleware (auth, validation)
          -> controller
            -> service (business logic, e.g. queue priority calc)
              -> model (CRUD against config/db.js)
```

## Persistence layer

`server/config/db.js` wraps a `lowdb` JSON file as a stand-in for
MongoDB (see README for why). It exposes:

- `connectDB()` — called once at server startup.
- `getDB()` — returns the lowdb instance; `getDB().data.<collection>`
  is a plain array/object, same shape a Mongoose `.find()` would
  eventually return as POJOs.

## Frontend state

- **Auth/session** — React Context (`AuthContext`), since it's global
  and infrequently updated.
- **Everything else** — plain component-local `useState`/`useEffect`
  (with polling via `setInterval` where live updates matter — see
  "Real-time strategy" below), not Zustand. Zustand was installed in
  Phase 1 anticipating a need for shared cross-component state, but in
  practice every page's data (patients, queue, appointments, reports,
  etc.) turned out to be naturally scoped to that one page, fetched
  on mount and refreshed via polling or after a mutation — there was
  never a case where two unrelated components needed to share
  frontend-only state without a shared parent. Kept as an installed
  dependency rather than removed, in case a genuine cross-component
  state need appears in future work; not used anywhere as of Phase 18.

## Auth (Phase 2)

JWT issued on login, stored in `localStorage`, attached via Axios
request interceptor. `middleware/auth.js` verifies the token;
`middleware/authorize.js` checks role against an allowed list per
route.

## Real-time strategy (Phase 6-7)

The master spec allows polling as an explicit fallback to WebSockets
("If not, implement efficient polling"). This project uses **polling,
not WebSockets/socket.io** — `QueueBoardPage`, `DisplayScreenPage`, and
`TrackPage` all re-fetch on a fixed interval (5s for staff-facing
pages, 4s for the display screen, 5s for the patient tracking page)
via `setInterval` + cleanup in a `useEffect`. This was judged
"efficient enough" per spec wording because: queue state changes are
low-frequency relative to the poll interval (a hospital queue doesn't
reorder itself dozens of times per second), each poll is a single
lightweight JSON GET, and every poll target already has DB-level
filtering (by department/date) so payloads stay small. If this ever
needs true push-based updates, the natural upgrade path is
`socket.io` emitting on the same `queueEntryModel.update()` writes
that already exist — no controller logic would need to change, only
the transport.

## Public (unauthenticated) endpoints (Phase 7)

`server/routes/publicQueueRoutes.js`, mounted at `/api/public/queue`,
is the one deliberate exception to "every route requires
`requireAuth`." It exists because two client pages have no logged-in
user by design:

- `DisplayScreenPage` (`/display/:departmentId`) — runs unattended on
  a hospital TV.
- `TrackPage` (`/track/:queueEntryId`) — opened by a patient scanning
  a QR code on their own phone, no account.

Rather than a scoped "display-only" auth token, these routes are
fully open but return a **reduced projection** — see
`publicQueueController.js`'s header comment and `docs/API.md` — that
never includes patient-identifying fields. This is enforced by an
automated test, not just convention. The client talks to these routes
through a *separate* axios instance
(`client/src/services/publicQueueService.js`), deliberately not the
shared `api.js`, so a JWT is never accidentally attached and the
401-redirect-to-login interceptor never fires on a page an
unauthenticated patient might be viewing.

## Dashboard aggregation (Phase 10)

`GET /api/dashboard/summary` is a single server-side aggregating
endpoint rather than the admin dashboard client composing many
parallel requests (e.g. one `GET /api/queue?departmentId=` per
department, plus separate calls for appointments/patients/workload).
This was chosen because several of the required numbers —
`averageWaitingMinutes`, `averageConsultationMinutes`,
`patientsByHour`, `doctorWorkload` — need to scan every queue entry
for the day *regardless of department*, which is naturally a
single server-side pass over `db.data.queueEntries` rather than
something the client could reasonably reassemble from per-department
responses. The endpoint is `admin`-only and pure read/compute — it
never mutates state, so it carries none of the audit-logging or
state-machine concerns the rest of the API has to worry about.

## Reports architecture (Phase 11)

The master spec asks for 8 distinct report types (Daily Patient,
Department, Doctor Performance, Waiting Time, Appointment, Queue
Performance, Emergency Patient, No-Show), each filterable and
exportable. Rather than 8 separate endpoints with 8 separate response
shapes, `server/controllers/reportController.js` uses **one route,
`GET /api/reports/:type`**, dispatching to a small builder function
per type via a lookup table (`REPORT_BUILDERS`). Every builder returns
the exact same `{ columns, rows }` shape (`columns` are header
labels; `rows` are arrays of cell values, positionally matching
`columns`).

This uniform shape is the actual point of the design: the client's
`ReportsPage` renders **any** report through one generic table
component, and `reportService.downloadReportCSV()` builds a CSV from
`columns`/`rows` generically — neither needs to know anything
report-specific. Adding a 9th report type later means adding one
builder function to the lookup table and one entry to
`listReportTypes()`; no client changes required.

**CSV export** happens entirely client-side (build a CSV string from
the already-fetched JSON, trigger a `Blob` download) rather than a
server CSV endpoint — report result sets here are bounded to a single
day's hospital activity, never large enough to justify server-side
streaming.

**Print-friendly output** reuses the existing report page rather than
a separate print route: a `.print-hide` utility class (added to
`index.css`) hides the sidebar/navbar/filter controls under a
`@media print` rule, so `window.print()` on `ReportsPage` produces a
clean title + table. This also satisfies the spec's "PDF export if
practical" note without adding a PDF library — every modern browser's
print dialog offers "Save as PDF" against exactly this print-friendly
view.

## In-app notifications (Phase 12)

Per the master spec (section 23), notifications are **in-app only** —
no SMS/email is ever sent or faked. `server/services/
notificationService.js` provides one typed function per event
(`notifyTokenGenerated`, `notifyTokenCalled`, `notifyQueueUpdated`,
`notifyAppointmentConfirmed`/`Cancelled`, `notifyConsultationCompleted`),
called from the exact same trigger points the audit log already hooks
into (`queueTransitionService.transitionQueueEntry`,
`queueController.generateToken`/`callNext`,
`appointmentController.updateAppointment`) — one central place per
action, not scattered ad hoc calls.

**Recipient scoping decision**: every notification targets the
*assigned doctor's* user account. Patients have no login in this
system (see the users/doctors split note in `docs/DATABASE.md`), so
there's no patient inbox to notify into — the patient-facing
equivalent of "your appointment was confirmed" is the live `/track`
page from Phase 7, not a notification. Reception/admin could
reasonably also want some of these events surfaced, but "the doctor
whose queue/appointment this affects" is the one recipient every event
type unambiguously has, so that's the scope implemented. Broadening to
other roles is a natural extension if a concrete need arises.

**Delivery mechanism**: the navbar's `NotificationBell` polls
`GET /api/notifications/unread-count` every 15s (same polling pattern
as everywhere else — see "Real-time strategy" above) so the badge
count stays current without the user opening the dropdown. The full
notification list itself is only fetched when the dropdown is opened,
not on every poll tick, to avoid pulling content the user isn't
looking at.

**Bug found and fixed this phase**: `appointmentController.
updateAppointment` originally compared `req.body.status !==
existing.status` *after* calling `appointmentModel.update()` to decide
whether to fire a confirmation/cancellation notification. This
silently never fired, because `appointmentModel.update()` (like every
model's `update()` in this codebase) does `Object.assign(record,
updates)` on the **same object reference** that `findById()` returned
earlier — so `existing` and the post-update record are literally the
same object, and by the time the comparison ran, `existing.status`
had already been mutated to the new value. Fixed by capturing
`previousStatus = existing.status` *before* calling `update()`. Every
other place in the codebase that compares pre/post state (e.g.
`doctorController.updateDoctor`'s room-sync logic) was audited and
confirmed to already read `existing` fields before its mutating
`update()` call, so this was an isolated ordering mistake in the new
notification code, not a systemic pattern — but it's a sharp edge
worth remembering for any future controller that needs a "did this
field change?" check: capture the old value before, not after,
calling a model's `update()`.

## Security & validation hardening (Phase 15)

A review pass across the whole app, not new features (aside from
closing the user-management gap below). Findings:

**Staff/user management gap closed.** `/admin/users` had been a
placeholder since Phase 1 — flagged as a known issue at the end of
Phase 14 and closed first this phase, since account provisioning is
itself a security concern. `server/controllers/userController.js` +
`/api/users` now cover create/edit/deactivate/reset-password for
`admin`/`receptionist`/`nurse` accounts (doctor accounts remain
managed via `/api/doctors` from Phase 4, by design — no overlap).

**Route audit.** Every route file under `server/routes/` was checked
by hand: every mutating (`POST`/`PUT`/`DELETE`) route has both
`requireAuth` and the correct `authorize(...)` role list; every `GET`
route requires at least `requireAuth` unless it's one of the three
intentionally-public exceptions (`/health`, `POST /auth/login`,
`/public/queue/*` — all documented above). No gaps found.

**Error-handling fix**: `middleware/errorHandler.js` previously passed
an unexpected (non-`AppError`) exception's raw `.message` straight
through to the client on a 500 — meaning a genuine bug (e.g. a
`TypeError` with an internal field name in its message) could leak
implementation details in an API response. Fixed: unexpected
exceptions at 500 now always return a generic `"Internal server
error"` to the client, while the real message and stack still go to
the server console (gated by `NODE_ENV !== 'test'`, unchanged from
Phase 1). Deliberately-crafted `AppError`s (which every controller
already uses for safe, intentional messages like `"Patient not
found"`) are unaffected at any status code — only truly unexpected
exceptions get the generic treatment. Covered by
`server/tests/errorHandling.test.js`.

**Secrets review.** `.env.example` matches every variable actually
read in `config/env.js`; the `JWT_SECRET` production-default warning
(Phase 1) still fires correctly; `passwordHash` is confirmed stripped
from every user-returning response via `userModel.toPublicUser()`
(covered by tests since Phase 2, re-verified this phase for the new
`/api/users` endpoints too). The only application-level `console.log`
calls outside `node_modules` are in `server/seed/seed.js`, which
intentionally prints demo credentials to the terminal for local setup
— a dev-only script, never part of a request path, not a leak.

**Validation audit.** Every `POST`/`PUT` route with a body already had
express-validator rules from the phase that introduced it; spot-check
of later phases (dashboard/reports/notifications/audit-logs, which
are read-only) confirmed they don't need body validation and handle
missing/malformed query params gracefully (defaulting rather than
crashing — already true since those phases were built, reconfirmed
here).

## Code-splitting (Phase 17)

Every page component is now lazy-loaded (`React.lazy()` +
`Suspense`) in `client/src/routes/AppRoutes.jsx`, instead of every
route being eagerly imported (and therefore bundled into one chunk)
regardless of which role ever visits it. This had been flagged as a
growing concern since Phase 10, when `AdminDashboardPage` first pulled
in Recharts and the main bundle jumped from ~1.11MB to ~1.49MB — every
role's initial page load was paying for a charting library only
admins ever use.

**Measured result**: the main chunk dropped from ~1.51MB to ~882KB.
`AdminDashboardPage` (and Recharts with it) is now its own ~378KB
chunk, fetched only when a user actually navigates to
`/admin/dashboard` — a receptionist or doctor's session never
downloads it at all. Every other page similarly split into its own
small chunk (typically 1-9KB), fetched on first visit to that route
and cached by the browser thereafter.

**Suspense fallback**: a single `<Suspense>` wraps the whole route
tree with a light `PageFallback` (reuses `LoadingSpinner`) for the
general app, matching `DashboardLayout`'s aesthetic. `DisplayScreenPage`
(dark, full-screen, meant for an unattended TV) gets its own nested
`<Suspense>` with a matching dark fallback — the shared light fallback
would otherwise flash awkwardly on a screen that's supposed to look
like a dedicated kiosk display, not a web app mid-load.

## Front-line dashboards and settings (Phase 21)

**Why `/api/dashboard/operations` is a separate endpoint.** The
receptionist and nurse dashboards need live counts across every
department. `GET /api/dashboard/summary` already aggregates server-side,
but it is admin-only (a test pins that) and carries analytics - average
waits, hourly charts, per-doctor workload - that front-line staff don't
need. Loosening it would have changed a completed phase's behaviour and
exposed more than necessary. So `operations` is its own read-only
endpoint: live counts, per-department queue heads, and nothing that
identifies a patient. Composing the same picture client-side would have
meant one `GET /api/queue?departmentId=` per department on every
refresh - the same reason Phase 10 chose a single aggregating endpoint.

It reuses `queueEntryModel.getOrderedWaitingQueue`, the exact function
the queue board uses, so "next token" on a dashboard can never disagree
with who "Call next" would call. "Today" uses the same UTC date
definition as the rest of the app for the same reason: numbers must
agree with the queue board, even though that means the day rolls over at
05:30 for a hospital in IST.

**Client refresh.** `hooks/useOperationsSummary` polls every 15 seconds
(slower than the queue board's 5s - these are overview numbers, not an
action surface). A background refresh never shows the loading spinner,
keeps the last good data if a refresh fails (the "Updated hh:mm:ss"
label makes staleness visible), and skips polling while the tab is
hidden. The reception page refetches its appointment list whenever the
summary refreshes rather than running a second timer.

**Settings: expose only what is honoured.** `hospitalSettings` holds two
values but only `averageConsultationMinutes` is ever read (as the
fallback when a doctor has no personal average). `queueTokenPrefixes`
is not read anywhere - the prefixes are constants in the queue model -
so the API neither returns nor accepts it, and the Settings page shows
token format and serving order as a read-only reference. Making the
prefixes editable would have meant changing the queue engine (a
completed phase) and, until then, would have been a control that does
nothing. A test proves the one exposed setting is genuinely wired: it
changes the wait estimate of a doctor with no personal average, both on
the staff queue and the public tracking page - and leaves a doctor who
has one unaffected.
