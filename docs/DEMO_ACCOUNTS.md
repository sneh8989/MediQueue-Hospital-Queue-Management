# Demo Accounts Reference

> **Security Notice:**
> The accounts below are predefined test credentials created by running `npm run seed`.
> They are strictly intended for local development, demonstration, and automated testing.
> In a production deployment, all default accounts must have their passwords rotated immediately, or be created through standard administrative provisioning with strong unique secrets.

## Standard Seed Accounts

| Role | Name | Email | Default Password | Description |
|---|---|---|---|---|
| **Admin** | Ava Administrator | `admin@mediqueue.test` | `Admin@123` | Full system access: departments, doctors, rooms, staff accounts, reports, settings, audit logs. |
| **Receptionist** | Riya Reception | `reception@mediqueue.test` | `Reception@123` | Front desk operations: patient registration, appointment scheduling, queue token generation, check-in. |
| **Doctor** | Dr. Sam Patel | `doctor@mediqueue.test` | `Doctor@123` | Clinical operations: queue dashboard, consultations, diagnoses, multi-item prescriptions. |
| **Nurse** | Nina Nurse | `nurse@mediqueue.test` | `Nurse@123` | Clinical floor oversight: queue observation, triage status monitoring, caller operations. |

## How to Seed

To populate the local store with these demo accounts:

```bash
npm run seed
```

This runs `server/seed/seed.js`, which securely hashes passwords using `bcrypt` and skips any accounts that already exist.

