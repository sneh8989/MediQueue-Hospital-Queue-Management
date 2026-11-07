# Database Design

## Current implementation

Development uses a JSON file (`server/data/db.json`) via `lowdb`
instead of MongoDB (see README for why). Every collection below is
now fully implemented (see the ✅ markers) — this doc was updated
incrementally as each phase built out its collection.

## Collections (implemented so far marked ✅; rest are planned shape)

- **users** ✅ — id, name, email, passwordHash, role, isActive, timestamps
- **patients** ✅ — id, patientCode (auto `P-0001`, `P-0002`, ...), name,
  dob, age (auto-computed from dob), gender, phone, email, address,
  emergencyContact `{ name, phone }`, bloodGroup, medicalNotes,
  isActive, timestamps
- **departments** ✅ — id, name, description, isActive, timestamps.
  Deactivated via soft-delete (`isActive: false`), never hard-removed.
- **doctors** ✅ — id, userId, name, specialization, departmentId,
  roomId, phone, avgConsultationMinutes, schedule, isActive,
  timestamps.
  **Design note — why doctors are split across `users` and `doctors`:**
  a doctor needs to *log in* (handled by `users`, same as any other
  staff role) but also has clinical/scheduling metadata that has
  nothing to do with authentication (department, room, average
  consultation time). Keeping these separate means a doctor's account
  can be deactivated without losing the `doctors` row that
  consultations/appointments will reference, and it mirrors how a real
  Mongoose schema would model a one-to-one relation via a `ref`.
- **rooms** ✅ — id, number, departmentId, doctorId, status
  (`available`/`occupied`/`maintenance`), timestamps. Kept in sync
  with `doctors.roomId` by the doctor controller: assigning/unassigning
  a doctor automatically flips the room's status and back-reference.
- **appointments** ✅ — id, patientId, doctorId, departmentId, date
  (YYYY-MM-DD), timeSlot (HH:mm), status, notes, timestamps. Status
  values: `scheduled`, `confirmed`, `waiting`, `in_consultation`,
  `completed`, `cancelled`, `no_show` — mirrors
  `client/src/constants/statuses.js` `APPOINTMENT_STATUS` exactly.
  **Conflict prevention**: no two non-cancelled/no-show appointments
  can share the same `doctorId` + `date` + `timeSlot`; enforced in
  `appointmentModel.findConflict()`, checked on both create and any
  reschedule (change of doctor/date/timeSlot on update).
- **queueEntries** ✅ — id, token, patientId, appointmentId
  (nullable), departmentId, doctorId, queueType (normal/appointment/
  emergency), priority (emergency/senior_citizen/pregnant/
  special_needs/normal), status (waiting/called/in_consultation/
  completed/skipped/cancelled/no_show), date (YYYY-MM-DD — the token's
  day, since numbering resets daily), calledAt, startedAt,
  completedAt, timestamps. Full priority-ordering and state-machine
  logic documented in `docs/QUEUE_LOGIC.md`.
- **consultations** ✅ — id, queueEntryId, patientId, doctorId,
  chiefComplaint, symptoms, diagnosis, notes, followUpDate, timestamps.
  One consultation per queue entry (enforced in the controller, not a
  unique DB constraint — this store has none). Created only once a
  queue entry reaches `in_consultation`; completing it can optionally
  also transition the queue entry to `completed` in one request (see
  `docs/API.md` Consultations section and `docs/QUEUE_LOGIC.md`).
- **prescriptions** ✅ — id, consultationId, patientId, doctorId,
  items: [{ id, medicineName, dosage, frequency, duration,
  instructions }], timestamps. One prescription per consultation
  (enforced in the controller, mirroring the one-consultation-per-
  queue-entry rule from Phase 8). **Design note**: `items` is an
  embedded array on the prescription document rather than a separate
  `PrescriptionItem` collection — this isn't a lowdb-specific shortcut;
  the equivalent Mongoose schema would also model prescription items
  as an embedded subdocument array (`items: [prescriptionItemSchema]`)
  rather than a second top-level collection with foreign keys, since
  items have no independent existence outside their prescription and
  are always read/written together.
- **notifications** ✅ — id, userId, type, message, read, createdAt.
  `userId` is always a staff user's id (never a patient's — patients
  have no login). Types: `token_generated`, `token_called`,
  `queue_updated`, `appointment_confirmed`, `appointment_cancelled`,
  `consultation_completed`. Created only as a side effect of other
  actions, never via a direct create endpoint — see
  `docs/ARCHITECTURE.md` "In-app notifications".
- **auditLogs** ✅ — id, userId, userName, action, entity, entityId,
  description, createdAt. Written since Phase 2 by every mutating
  controller in the app; queryable (filterable by userId/action/
  entity/date, capped at 200 results) and surfaced in the admin UI
  since Phase 14.
- **hospitalSettings** ✅ — `averageConsultationMinutes` (the
  hospital-wide fallback for wait estimates; readable/editable by an
  admin via `/api/settings` since Phase 21) and `queueTokenPrefixes`
  (present in the store but **not read by anything** - token prefixes
  are fixed constants in `queueEntryModel.js`, so it is deliberately not
  exposed or editable).

## Migration path to MongoDB

Because controllers only call `getDB()`/model functions and never
touch the file store directly, moving to real MongoDB means: (1) add
Mongoose schemas matching the shapes above, (2) swap the model layer's
implementation, (3) set `MONGODB_URI`. No controller changes needed.
