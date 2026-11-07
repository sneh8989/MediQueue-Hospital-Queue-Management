# Queue Logic

_This is the core module of the system — implemented in Phase 6. This
file documents the design up front so the implementation has a clear
spec to build against and be checked against._

## Token format

`<Prefix>-<sequence>` per department per day, e.g. `A-027`. Prefix
depends on queue type: Normal = `A`, Appointment = `B`, Emergency =
`E`. These are fixed constants in `queueEntryModel.js` (not
configurable - `hospitalSettings.queueTokenPrefixes` exists in the
store but nothing reads it; the admin Settings page shows them
read-only).

## Priority ordering

Queue position is **not** simple FIFO by token number. Each queue
entry has a `priority` weight (lower = served sooner):

| Priority            | Weight |
|----------------------|--------|
| Emergency            | 0      |
| Senior Citizen        | 1      |
| Pregnant Patient      | 1      |
| Disabled / Special    | 1      |
| Normal                | 2      |

Within the same weight, patients are ordered by token creation time
(FIFO). This means an Emergency patient always jumps ahead of a
waiting Normal patient, but two Senior Citizens are served in the
order they checked in.

## Estimated waiting time

```
estimatedWaitMinutes = patientsAhead * averageConsultationMinutes
```

`averageConsultationMinutes` is configurable per doctor (falls back to
the hospital-wide default in `hospitalSettings`, which an admin can
change under Settings). `patientsAhead` is
computed from the priority-ordered queue, not raw token order.

## State machine

```
waiting -> called -> in_consultation -> completed
   |          |
   v          v
skipped   (recall -> called)
   |
   v
cancelled / no_show
```

- **Call Next** — picks the highest-priority `waiting` entry, sets it
  to `called`.
- **Skip** — moves a `called` entry to `skipped` without serving it;
  it can be recalled later.
- **Recall** — moves a `skipped` entry back to `called`.
- **Start Consultation** — `called -> in_consultation`.
- **Complete** — `in_consultation -> completed`, timestamps recorded
  for reporting (used for average consultation time).

## Implementation status (Phase 6, complete)

Implemented exactly as designed above, verified by
`server/tests/queue.test.js` — in particular the test
`priority ordering: an emergency token created LAST is still queued
FIRST` proves the core guarantee: an emergency entry created after two
normal entries still has `patientsAhead: 0` and is served first by
`callNext`.

One clarification not fully spelled out above: token **numbering is
shared across queue types within a department/day**, not independent
per prefix. E.g. if a normal walk-in gets `A-001`, the next token —
even an emergency one — is `E-002`, not `E-001`. This keeps every
token in a department unique and chronologically orderable by number
alone, which matters for audit trails and display screens (Phase 7),
even though actual serving order is priority-based, not
number-based.

`estimatedWaitMinutes` and `patientsAhead` are computed live on every
read (not stored), since they change as the queue changes — storing
them would risk staleness.

## Phase 8 update: a second path to Complete

The **Complete** transition (`in_consultation -> completed`) now has
two entry points that share one implementation:

1. The queue board's own Complete button (`POST /api/queue/:id/complete`).
2. A doctor's consultation form, via
   `PUT /api/consultations/:id` with `completeConsultation: true`.

Both call the exact same `completeQueueEntry()` function in
`server/services/queueTransitionService.js` — the state-machine
validation (must currently be `in_consultation`) and audit logging
were extracted out of `queueController.js` specifically so
`consultationController.js` could reuse them rather than
reimplementing the same check. There is only one place that decides
whether a Complete transition is valid.
