# API Reference

Base URL: `/api`

All responses follow the shape:

```json
{ "success": true, "...": "..." }
```
or on error:
```json
{ "success": false, "message": "...", "details": {} }
```

## Implemented

### `GET /api/health`
Returns API status. No auth required.

```json
{ "success": true, "message": "Hospital Queue Management API is running", "timestamp": "..." }
```

### `POST /api/auth/login`
No auth required. Body: `{ email, password }`.

```json
// 200
{ "success": true, "token": "<jwt>", "user": { "id", "name", "email", "role", "isActive", ... } }
```
`400` on validation failure (malformed email / missing password), `401`
on wrong credentials, `403` if the account is deactivated.

### `GET /api/auth/me`
Requires `Authorization: Bearer <token>`. Returns the current user.
`401` if missing/invalid/expired token.

### `POST /api/auth/logout`
Requires auth. Stateless (JWT is discarded client-side); records an
audit log entry. `200` always on success.

## Auth for protected routes

Send `Authorization: Bearer <token>` on every request after login.
`middleware/auth.js` verifies the token; routes that need role
restrictions add `middleware/authorize.js` (e.g.
`authorize('admin')`).

## Patients

All endpoints require `Authorization: Bearer <token>`.

### `GET /api/patients`
Any authenticated role. Query params: `search` (matches name,
patientCode, or phone), `gender`, `bloodGroup`.

```json
{ "success": true, "count": 1, "patients": [ { "id", "patientCode", "name", "dob", "age", "gender", "phone", "email", "address", "emergencyContact", "bloodGroup", "medicalNotes", "isActive", "createdAt", "updatedAt" } ] }
```

### `GET /api/patients/:id`
Any authenticated role. `404` if not found.

### `POST /api/patients`
**admin or receptionist only** (`403` for other roles). Body requires
`name`, `gender` (`male`/`female`/`other`), `phone`; optional `dob`
(ISO date), `email`, `address`, `bloodGroup`, `emergencyContact`,
`medicalNotes`. `patientCode` is auto-generated (`P-0001`, `P-0002`,
...) and `age` is auto-computed from `dob` when provided. `400` on
validation failure.

### `PUT /api/patients/:id`
**admin or receptionist only**. Same validation as create. Recomputes
`age` if `dob` changes.

## Departments

All require `Authorization: Bearer <token>`.

- `GET /api/departments` — any role. `?includeInactive=true` (admin only) also returns deactivated departments.
- `GET /api/departments/:id` — any role.
- `POST /api/departments` — **admin only**. Body: `{ name, description? }`. `409` on duplicate name.
- `PUT /api/departments/:id` — **admin only**.
- `DELETE /api/departments/:id` — **admin only**. Soft-deletes (sets `isActive: false`) rather than removing the row, so historical doctors/rooms/appointments still resolve.

## Doctors

All require `Authorization: Bearer <token>`.

- `GET /api/doctors` — any role. `?departmentId=` filters. Each doctor includes resolved `departmentName`/`roomNumber`.
- `GET /api/doctors/me` — **doctor only**. Resolves the logged-in user's own doctor record (department/room/avgConsultationMinutes) without needing to know their `doctorId`. `404` if the account has no linked doctor record, `403` for non-doctor roles. Added in Phase 8 to power the doctor dashboard.
- `GET /api/doctors/:id` — any role.
- `POST /api/doctors` — **admin only**. Body: `{ name, departmentId, roomId?, specialization?, phone?, avgConsultationMinutes?, schedule?, ... }` plus **either**:
  - `{ email, password }` — creates a new `users` login with role `doctor` in the same request, **or**
  - `{ userId }` — links an already-existing user account instead.

  `400` if `departmentId` doesn't exist, `409` if the email/userId is already taken. If `roomId` is set, that room is automatically marked `occupied` and linked back to the doctor.
- `PUT /api/doctors/:id` — **admin only**. Changing `roomId` automatically frees the old room (`available`) and occupies the new one.
- `DELETE /api/doctors/:id` — **admin only**. Soft-deletes; frees any assigned room.

## Rooms

All require `Authorization: Bearer <token>`.

- `GET /api/rooms` — any role. `?departmentId=`/`?status=` filters. Each room includes resolved `departmentName`/`doctorName`.
- `GET /api/rooms/:id` — any role.
- `POST /api/rooms` — **admin only**. Body: `{ number, departmentId, status? }` (`status` defaults to `available`; must be `available`/`occupied`/`maintenance`). `409` on duplicate room number, `400` if department doesn't exist.
- `PUT /api/rooms/:id` — **admin only**.
- `DELETE /api/rooms/:id` — **admin only**. Hard-deletes (rooms don't carry history the way patients/doctors do).

## Appointments

All require `Authorization: Bearer <token>`.

- `GET /api/appointments` — any role. Filters: `?date=`, `?doctorId=`,
  `?departmentId=`, `?patientId=`, `?status=`. **Doctors are
  automatically scoped to their own appointments** regardless of
  `doctorId` passed — the server resolves their `doctors` record from
  their JWT and ignores any attempt to view someone else's list.
  Each result is enriched with `patientName`, `patientCode`,
  `patientPhone`, `doctorName`, `departmentName`.
- `GET /api/appointments/today` — same scoping rules as above, fixed
  to today's date server-side (used for dashboard "Today's
  Appointments" widgets).
- `GET /api/appointments/:id` — any role. `404` if missing.
- `POST /api/appointments` — **admin/receptionist only**. Body:
  `{ patientId, doctorId, departmentId, date (ISO), timeSlot (HH:mm),
  notes? }`. `400` if patient/doctor/department don't exist. **`409`
  if the doctor already has a non-cancelled appointment at that exact
  date+timeSlot** (double-booking prevention). Defaults `status` to
  `scheduled`.
- `PUT /api/appointments/:id` — **admin/receptionist**: can change
  anything (patient, doctor, date, time, status, notes) — reschedule
  is just changing `date`/`timeSlot`, which re-runs the same conflict
  check against every other active appointment. **Doctors**: can only
  update `status` and `notes` on **their own** appointments (`403`
  otherwise) — e.g. marking a consultation `completed`.

## Queue

All require `Authorization: Bearer <token>`. Mutating actions are
restricted to `admin`/`receptionist`/`nurse`/`doctor` (any staff role
that actually runs a queue day-to-day).

- `GET /api/queue?departmentId=&date=` — the full live picture for a
  department/day in one call: `waiting` (priority-ordered, each entry
  annotated with `patientsAhead` and `estimatedWaitMinutes`), plus
  `called`, `inConsultation`, `completed`, `skipped`, and a `counts`
  summary. `date` defaults to today. `departmentId` is required.
- `GET /api/queue/history?patientId=` — every queue entry for a
  patient across all departments/dates, most recent first (powers the
  patient profile's Queue History section).
- `GET /api/queue/:id` — a single entry, enriched.
- `POST /api/queue/token` — generates a token. Either
  `{ patientId, departmentId, doctorId, priority? }` for a walk-in, or
  `{ appointmentId }` to convert an existing appointment into a queue
  entry (pulls patient/doctor/department from it, marks the
  appointment `waiting`). `priority` defaults to `normal`;
  `priority: 'emergency'` sets `queueType` to `emergency` too. `400`
  if patient/doctor/department/appointment don't exist.
- `POST /api/queue/call-next` — body `{ departmentId }`. Calls the
  single highest-priority waiting entry (not just the oldest token).
  `404` if nothing is waiting.
- `POST /api/queue/:id/call` — call a specific waiting entry directly.
- `POST /api/queue/:id/skip` — `called` → `skipped`.
- `POST /api/queue/:id/recall` — `skipped` → `called`.
- `POST /api/queue/:id/start` — `called` → `in_consultation`.
- `POST /api/queue/:id/complete` — `in_consultation` → `completed`.
- `POST /api/queue/:id/cancel` — `waiting`/`called`/`skipped` → `cancelled`.
- `POST /api/queue/:id/no-show` — `called`/`skipped` → `no_show`.

Every state-changing action returns `409` if the entry isn't in a
valid starting state for that transition (e.g. skipping a `waiting`
entry, or starting a consultation before it's been called) — see
`docs/QUEUE_LOGIC.md` for the full state machine.

## Public Queue (no authentication)

These endpoints deliberately require **no** `Authorization` header —
they power the unattended hospital TV display screen and the
patient-facing tracking page reached via QR code, neither of which
has a logged-in user. **Design decision**: rather than requiring a
lightweight "display token," these are fully public but return a
**reduced projection** that never includes `patientName`,
`patientCode`, `patientId`, or `patientPhone` — enforced by an
automated test (`publicQueue.test.js`) that asserts those keys never
appear in the response. Only the queue entry's opaque UUID is ever
placed in a URL (never a patient ID), per the master spec's QR
requirement (section 13).

- `GET /api/public/queue?departmentId=` — for the display screen.
  Returns `{ departmentName, currentToken: { token, doctorName,
  roomNumber } | null, nextToken: {...} | null, waitingCount }`.
  `400` if `departmentId` missing, `404` if the department doesn't
  exist.
- `GET /api/public/queue/:id` — for the patient tracking page (`/track/:id`
  on the client). Returns `{ token, status, priority, date, doctorName,
  departmentName, roomNumber, patientsAhead, estimatedWaitMinutes,
  currentToken }` for that single entry. `404` if the entry doesn't exist.

## Consultations

All require `Authorization: Bearer <token>`.

- `GET /api/consultations` — any authenticated role. Filters:
  `?patientId=`, `?doctorId=`, `?queueEntryId=`. **Doctors are
  automatically scoped to their own consultations** regardless of any
  `doctorId` passed, same pattern as appointments and queue history —
  the server resolves their `doctors` record from the JWT.
- `GET /api/consultations/:id` — any role. `404` if missing.
- `POST /api/consultations` — **doctor only**. Body:
  `{ queueEntryId, chiefComplaint?, symptoms?, diagnosis?, notes?,
  followUpDate? }`. `400` if the queue entry doesn't exist. `403` if
  the queue entry belongs to a different doctor. **`409` if the queue
  entry isn't currently `in_consultation`** (must hit Start on the
  queue board first) — a doctor can't back-date a consultation onto a
  waiting/called/completed entry. `409` if a consultation already
  exists for that queue entry (use `PUT` to edit it instead).
- `PUT /api/consultations/:id` — **doctor only**, and only the
  assigned doctor (`403` otherwise). Updates any subset of
  `chiefComplaint`/`symptoms`/`diagnosis`/`notes`/`followUpDate`.
  Optionally include `completeConsultation: true` to **also** move the
  underlying queue entry to `completed` in the same request — this
  calls the identical `completeQueueEntry()` service the queue board's
  own Complete button uses (see `server/services/
  queueTransitionService.js`), so the two can never fall out of sync.

## Prescriptions

All require `Authorization: Bearer <token>`.

- `GET /api/prescriptions` — any authenticated role. Filters:
  `?patientId=`, `?doctorId=`, `?consultationId=`. **Doctors are
  automatically scoped to their own prescriptions**, same pattern as
  consultations/appointments/queue.
- `GET /api/prescriptions/:id` — any role. `404` if missing.
- `POST /api/prescriptions` — **doctor only**. Body:
  `{ consultationId, items: [{ medicineName, dosage, frequency?,
  duration?, instructions? }, ...] }`. Requires at least one item;
  each item requires `medicineName` and `dosage` at minimum
  (`frequency`/`duration`/`instructions` are optional and default to
  `null`). `400` if the consultation doesn't exist. `403` if the
  consultation belongs to a different doctor. **`409` if a
  prescription already exists for that consultation** (use `PUT` to
  revise it instead — one prescription per consultation, same
  one-per-entity pattern as consultations per queue entry).
- `PUT /api/prescriptions/:id` — **doctor only**, and only the
  assigned doctor (`403` otherwise). Body: `{ items: [...] }` —
  replaces the full item list (not a partial merge).

## Dashboard

- `GET /api/dashboard/summary?date=` — **admin only**. `date` defaults
  to today (`YYYY-MM-DD`). Single aggregating endpoint for the admin
  overview screen — see `docs/ARCHITECTURE.md` for why this is one
  endpoint rather than the client composing many per-department calls.
  Returns:
  ```json
  {
    "date": "2026-08-22",
    "stats": {
      "totalPatientsToday": 0, "totalAppointmentsToday": 0,
      "waitingPatients": 0, "patientsInConsultation": 0,
      "completedConsultations": 0, "emergencyPatients": 0,
      "averageWaitingMinutes": 0, "averageConsultationMinutes": 0
    },
    "charts": {
      "patientsByDepartment": [{ "department": "...", "count": 0 }],
      "patientsByHour": [{ "hour": 0, "count": 0 }],
      "appointmentsByStatus": [{ "status": "...", "count": 0 }],
      "queueByStatus": [{ "status": "...", "count": 0 }],
      "doctorWorkload": [{ "doctor": "...", "count": 0 }]
    }
  }
  ```
  `averageWaitingMinutes` = mean time from token creation to being
  called, across all of that day's called entries.
  `averageConsultationMinutes` = mean time from start to completion,
  across all of that day's completed entries. Both round to the
  nearest whole minute and are `0` (not `null`/`NaN`) when there's no
  data yet.

- `GET /api/dashboard/operations?date=` — **admin, receptionist,
  nurse**. `date` defaults to today; `400` if not `YYYY-MM-DD`. A live
  front-line snapshot for the Reception and Nurse dashboards: counts
  and queue heads only - **no analytics and no patient names or contact
  details**. Deliberately separate from `/summary` (which stays admin-
  only) - see `docs/ARCHITECTURE.md` "Front-line dashboards and
  settings (Phase 21)". Returns:
  ```json
  {
    "date": "2026-09-30",
    "totals": { "waiting": 0, "called": 0, "inConsultation": 0,
                "completed": 0, "skipped": 0, "emergencyWaiting": 0 },
    "appointments": {
      "total": 0,
      "byStatus": { "scheduled": 0, "confirmed": 0, "waiting": 0,
                    "in_consultation": 0, "completed": 0,
                    "cancelled": 0, "no_show": 0 }
    },
    "departments": [{
      "departmentId": "...", "departmentName": "...", "activeDoctors": 1,
      "waiting": 0, "called": 0, "inConsultation": 0, "completed": 0,
      "skipped": 0, "emergencyWaiting": 0,
      "nextToken": "E-005", "longestWaitMinutes": 12
    }]
  }
  ```
  Every appointment status is always present (zero-filled).
  `departments` lists only departments with an active doctor or any
  queue activity on that date, ordered emergencies-first, then longest
  queue, then name. `nextToken` comes from the same priority-aware
  ordering "Call next" uses (so it is who would actually be called).
  `longestWaitMinutes` is the age of the oldest waiting token, or `null`
  when nobody is waiting **or the date is not today** (elapsed time
  would be meaningless for a past/future day). `emergencyWaiting`
  counts waiting entries whose `priority` is `emergency`.

## Reports

Both endpoints are **admin only**. See `docs/ARCHITECTURE.md` "Reports
architecture" for why this is one flexible endpoint rather than 8
bespoke routes.

- `GET /api/reports/types` — lists the 8 available report types with
  human-readable labels, for populating a report-type selector.
- `GET /api/reports/:type?date=&departmentId=&doctorId=&status=` —
  `date` defaults to today. `departmentId`/`doctorId` filter where
  applicable to that report; `status` only applies to the `appointment`
  report. Every report returns the same shape:
  ```json
  { "reportType": "...", "filters": {...}, "columns": ["..."], "rows": [["..."]], "count": 0 }
  ```
  `rows` is an array of arrays (one per record), positionally matching
  `columns` — this uniform shape is what lets a single generic table +
  CSV exporter handle every report type. `400` for an unrecognized
  `:type` (the error message lists the valid ones).

  Valid `:type` values and what each returns:
  - `daily-patient` — patients registered on the given date.
  - `department` — per-department totals/completed/waiting/emergency
    counts for the day.
  - `doctor-performance` — per-doctor patient counts + average
    consultation time for the day.
  - `waiting-time` — every called queue entry that day with its
    computed wait time (token creation → called).
  - `appointment` — appointments for the day, filterable by status.
  - `queue-performance` — per-department completion rate for the day.
  - `emergency` — every emergency-priority queue entry that day.
  - `no-show` — appointments marked `no_show` for the day.

## Notifications

All require `Authorization: Bearer <token>`. No role restriction — every
endpoint scopes to `req.user.sub`, so there's nothing to authorize by
role; a user only ever sees/modifies their own notifications.

- `GET /api/notifications?unreadOnly=true` — the caller's own
  notifications, most recent first. `unreadOnly` optionally filters.
- `GET /api/notifications/unread-count` — `{ count }` for badge display.
- `PUT /api/notifications/:id/read` — marks one notification read.
  `404` if unknown, **`403` if it belongs to a different user**.
- `PUT /api/notifications/read-all` — marks every unread notification
  for the caller as read, returns `{ markedCount }`.

**Notifications are never created directly via the API** — there is no
`POST /api/notifications`. They're created as a side effect of other
actions (token generated/called, queue entry skipped/recalled/
cancelled/no-show, consultation completed, appointment confirmed/
cancelled) via `server/services/notificationService.js`. See
`docs/ARCHITECTURE.md` "In-app notifications" for the recipient-scoping
decision (every notification currently targets the assigned doctor,
since patients have no login to receive notifications into).

## Audit Logs

Both endpoints are **admin only**, per the master spec's role list.

- `GET /api/audit-logs?userId=&action=&entity=&date=` — filtered audit
  trail, most recent first, capped at 200 entries. Every filter is
  optional. Entries have been written since Phase 2 by every mutating
  controller in the app (login/logout, patient/department/doctor/room
  create-update-deactivate, appointment create/update, every queue
  token transition, consultation/prescription create/update) — this
  phase only added the read endpoint and filters, not the writing.
- `GET /api/audit-logs/filter-options` — `{ actions: [...], entities:
  [...] }`, the distinct values seen so far, for populating filter
  dropdowns without hardcoding a list that could drift from reality.

## Users (Staff Management)

All endpoints **admin only**. Manages `admin`/`receptionist`/`nurse`
accounts. Doctor accounts are created/managed via `/api/doctors`
(Phase 4) — that endpoint creates the linked login in the same
request, so there's no overlap.

- `GET /api/users` — every staff account, `passwordHash` always
  stripped (via `userModel.toPublicUser()`).
- `GET /api/users/:id` — single account. `404` if unknown.
- `POST /api/users` — `{ name, email, password, role }`. `role` is
  constrained to `admin`/`receptionist`/`nurse` — attempting
  `role: 'doctor'` here is rejected by validation (`400`); use
  `POST /api/doctors` instead. `409` on duplicate email, `400` on a
  password under 6 characters.
- `PUT /api/users/:id` — edit `name`/`role`/`isActive`. Deactivating
  (`isActive: false`) immediately blocks that account from logging in
  (`403` on the next login attempt, same behavior as any deactivated
  account since Phase 2). **Cannot change an existing doctor's role
  away from `doctor`** through this endpoint (`400`) — that would
  desync the linked `doctors` collection row; there's no valid use
  case for it.
- `PUT /api/users/:id/reset-password` — admin sets a new password
  directly (no reset-token/email flow — this is an in-person/admin-
  assisted reset, appropriate for a college project's scope). Old
  password stops working immediately.

## Settings

Both endpoints are **admin only**.

- `GET /api/settings` — `{ "settings": { "averageConsultationMinutes": 5 } }`.
- `PUT /api/settings` — `{ "averageConsultationMinutes": 8 }`. Must be a
  whole number from 1 to 120 (a numeric string such as `"8"` is
  accepted and stored as a number); `400` otherwise, leaving the
  stored value untouched. Returns the same shape as `GET`. Writes one
  `settings_updated` audit entry (`entity: "settings"`) recording the
  old and new value; re-saving an unchanged value writes nothing.

`averageConsultationMinutes` is the hospital-wide **fallback** the queue
engine and the public tracking page use to estimate waits
(`patientsAhead × minutes`) for a doctor who has no
`avgConsultationMinutes` of their own. Doctors with their own value are
unaffected.

Only settings the system actually honours are exposed. `hospitalSettings`
also stores `queueTokenPrefixes`, but it is neither returned nor accepted
here: token prefixes are fixed constants in `queueEntryModel.js`, so an
editable prefix would change nothing.

## Planned (added as each phase ships)

*(none — every planned endpoint has shipped)*

This file is updated in the same commit/phase that adds each route —
if a route is documented here, it exists and has been tested.
