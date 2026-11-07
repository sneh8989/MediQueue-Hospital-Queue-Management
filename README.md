<<<<<<< HEAD
# Hospital Queue Management System (MediQueue)

[![CI Build & Test](https://github.com/placeholder-org/hospital-queue-management/actions/workflows/ci.yml/badge.svg)](https://github.com/placeholder-org/hospital-queue-management/actions/workflows/ci.yml)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tests Passing](https://img.shields.io/badge/tests-186%2F186%20passing-success)](docs/TESTING.md)
[![QA Verified](https://img.shields.io/badge/browser%20QA-Chrome%20Automated-success)](docs/TESTING.md)

A production-ready full-stack Hospital Queue Management System built to streamline the complete outpatient patient journey — from registration, appointment booking, and priority token allocation to live queue boards, doctor consultation workflows, multi-item electronic prescriptions, unattended digital displays, and administrative reporting.

---

## Table of Contents

- [Problem Statement](#problem-statement)
- [System Architecture](#system-architecture)
- [Core Features by Role](#core-features-by-role)
- [Priority Queue Preemption Logic](#priority-queue-preemption-logic)
- [Technology Stack](#technology-stack)
- [Folder Structure](#folder-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Configuration](#environment-configuration)
  - [Database Seeding](#database-seeding)
  - [Starting the Services](#starting-the-services)
- [Demo Accounts](#demo-accounts)
- [Automated Testing & Browser QA](#automated-testing--browser-qa)
- [Live System Screenshots](#live-system-screenshots)
- [API Documentation](#api-documentation)
- [Security Considerations](#security-considerations)
- [Roadmap & Future Enhancements](#roadmap--future-enhancements)
- [License](#license)

---

## Problem Statement

Outpatient hospital departments frequently suffer from chaotic waiting rooms, opaque queue visibility, patient anxiety, and administrative bottlenecks. Critical patients often get delayed behind routine walk-ins when queues operate solely on standard First-In-First-Out (FIFO) arrival order.

**MediQueue solves this by:**
1. Enforcing **strict, multi-tier priority preemption** (Emergency > Senior Citizen / Pregnant / Special Needs > Normal).
2. Providing **real-time visibility** across digital waiting room displays, live queue boards, and mobile patient tracking via QR code.
3. Offering **integrated doctor workflows** allowing simultaneous consultation notes, diagnosis tracking, and electronic prescriptions directly synchronized with queue state.
4. Ensuring **enterprise-grade auditability** through immutable action logging and role-based access control.

---

## System Architecture

```mermaid
flowchart TD
    subgraph Client ["Client Layer (React 19 + Vite + Tailwind CSS)"]
        UI_Admin["Admin Dashboard & Management"]
        UI_Reception["Reception Dashboard & Check-In"]
        UI_Doctor["Doctor Queue & Consultation Desk"]
        UI_Nurse["Nurse Live Queue Monitor"]
        UI_Display["Public Display Screen (TV)"]
        UI_Track["Mobile Patient Tracker (QR Code)"]
    end

    subgraph Gateway ["API Gateway & Middleware"]
        AuthMid["JWT Authentication & RBAC Middleware"]
        ValMid["Express-Validator & Input Sanitization"]
        RateMid["Security Headers (Helmet) & CORS"]
    end

    subgraph Server ["Server Application Layer (Express 5)"]
        AuthCtrl["Auth Controller"]
        QueueCtrl["Priority Queue Engine"]
        ApptCtrl["Appointment Controller"]
        ConsultCtrl["Consultation Controller"]
        PrescriptCtrl["Prescription Controller"]
        AdminCtrl["Hospital Admin & Reports"]
        AuditCtrl["Audit Log Service"]
    end

    subgraph Data ["Data Persistence Layer"]
        DB[(Local JSON / MongoDB LowDB Adapter)]
        AuditStore[(Audit Trail Store)]
    end

    Client --> Gateway
    Gateway --> Server
    Server --> Data
```

---

## Core Features by Role

### 1. Administrator (`admin`)
- **System Overview:** Real-time operational dashboard with metrics for waiting patients, active consultations, daily completions, and revenue estimates.
- **Hospital Infrastructure:** Complete CRUD management for Hospital Departments, Examination Rooms, and Doctors.
- **Staff Management:** Create, activate/deactivate, and securely reset passwords for receptionists, nurses, and doctors.
- **Reports & Analytics:** 8 dedicated reporting views (Daily Patient, Department Breakdown, Doctor Performance, Emergency Incident, Wait Times, Queue Metrics, No-Shows) with **instant CSV export** and print-ready styles.
- **Audit Logs:** Immutable audit log tracking actor identity, IP address, resource type, and timestamp for all critical hospital mutations.
- **System Settings:** Configurable hospital-wide default consultation duration driving dynamic wait-time estimation algorithms.

### 2. Receptionist (`receptionist`)
- **Front-Line Operations:** Live operational dashboard with arrival summaries, pending appointments, and emergency alerts.
- **Patient Registration:** Register new patients and update demographic and contact details.
- **Appointment Scheduling:** Book, reschedule, and cancel doctor appointments with **strict double-booking conflict prevention**.
- **Check-In & Token Issuance:** Instant token generation for scheduled appointments and walk-in arrivals with dynamic priority weighting and printable QR-code token slips.
- **Queue Board:** Full state-machine queue controls: **Call Next**, **Skip No-Shows**, **Recall Skipped Patients**, and **Direct Consult Call**.

### 3. Doctor (`doctor`)
- **Dedicated Consultation Desk:** Auto-scopes to the logged-in doctor's assigned department and room.
- **Queue Progression:** Seamless transition from `called` to `in_consultation` and `completed`.
- **Integrated Medical Records:** Record chief complaints, physical findings, clinical diagnosis, and follow-up appointment dates.
- **Multi-Item Electronic Prescriptions:** Prescribe multiple medicines per consultation with validated dosage, frequency, duration, and instructions.
- **Patient History:** Direct access to a patient's historical visit timeline, past consultations, and prescriptions.

### 4. Nurse (`nurse`)
- **Triage & Operations Monitor:** Real-time visibility into waiting, called, and active patient queues across departments.
- **Patient Assistance:** Assist with patient intake, queue status updates, and vital tracking.
- **Strict Permission Boundaries:** Prevented from unauthorized administrative alterations (enforced by 403 Forbidden checks).

### 5. Public & Unauthenticated Patient Experience
- **Waiting Room Display Screen:** High-contrast, dark-mode TV display designed for public hall monitors, showing "Now Serving" tokens, current rooms, and next-in-line tokens. **Zero PII exposure** (tokens only).
- **Mobile Queue Tracking:** Patients scan their token's QR code to view real-time position in queue, estimated wait time, and serving status on their mobile browser without creating an account.
- **Track Code Entry Portal:** Simple web portal (`/track`) allowing patients to manually type their tracking ID.

---

## Priority Queue Preemption Logic

The queue engine does **not** rely on simple arrival-time FIFO. Each generated token is assigned a priority weight:

| Priority Category | Token Prefix | Weight | Scheduling Preemption |
|---|---|---|---|
| **Emergency** | `E-###` | `0` | **Immediate preemption** — placed at front of queue regardless of arrival time |
| **Senior Citizen** | `A-###` | `1` | Served before Normal arrivals |
| **Pregnant** | `A-###` | `1` | Served before Normal arrivals |
| **Special Needs** | `A-###` | `1` | Served before Normal arrivals |
| **Normal** | `A-###` | `2` | Standard FIFO among normal arrivals |

When `POST /api/queue/call-next` is invoked, the queue engine queries all waiting entries ordered by `priorityWeight ASC, createdAt ASC`. Verified via automated browser testing: an Emergency patient arriving last is guaranteed to be called before all previously waiting normal patients.

---

## Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, Vite, React Router 6, Tailwind CSS v4, Lucide React, Axios, Recharts, React Hook Form, Zod |
| **Backend** | Node.js 20+, Express 5, JSON Web Tokens (JWT), Bcrypt.js, Helmet, Morgan, Express-Validator |
| **Data Layer** | LowDB (Zero-dependency local JSON engine with atomic persistence; direct drop-in architecture for MongoDB/Mongoose) |
| **Quality & Testing**| Node.js Native Test Runner (`node --test`), Puppeteer-Core (Automated Google Chrome QA), Oxlint |
| **CI / CD** | GitHub Actions matrix (`node-version: [20.x, 22.x]`) |

---

## Folder Structure

```
hospital-queue-management/
├── .github/
│   └── workflows/
│       └── ci.yml               # GitHub Actions CI matrix pipeline
├── client/                      # React 19 Single Page Application
│   ├── src/
│   │   ├── components/          # Modular UI components (appointments, queue, forms)
│   │   ├── constants/           # Roles, statuses, navigation definitions
│   │   ├── context/             # React AuthContext (JWT session management)
│   │   ├── layouts/             # DashboardLayout (responsive drawer) & AuthLayout
│   │   ├── pages/               # Role-based dashboard and workflow views
│   │   ├── routes/              # ProtectedRoute guards and code-split routes
│   │   └── services/            # Axios API integration clients
│   └── vite.config.js           # Vite configuration with API proxy
├── docs/                        # Complete technical documentation
│   ├── screenshots/             # 24 real browser automated QA screenshots
│   ├── API.md                   # Complete REST API reference
│   ├── ARCHITECTURE.md          # System architecture and design choices
│   ├── DATABASE.md              # Database schemas and collection contracts
│   ├── DEMO_ACCOUNTS.md         # Safe demo login instructions
│   ├── QUEUE_LOGIC.md           # Queue engine specifications & math
│   └── TESTING.md               # Test coverage analysis and verification logs
├── qa/
│   └── run-browser-tests.js     # Puppeteer automated Chrome browser QA suite
├── server/                      # Express 5 REST API
│   ├── config/                  # Database and environment initialization
│   ├── controllers/             # Business logic controllers
│   ├── middleware/              # Auth, RBAC, and centralized error handling
│   ├── models/                  # Data access models
│   ├── routes/                  # Express API route declarations
│   ├── seed/                    # Demo user and initial state seeding
│   ├── services/                # Queue state machines and token generator
│   └── tests/                   # 186 automated unit and regression tests
├── package.json                 # Monorepo scripts
└── README.md                    # Project documentation
```

---

## Getting Started

### Prerequisites
- Node.js 20.x or 22.x LTS installed
- Google Chrome browser (for running live automated browser QA)

### Installation

Clone the repository and install all root, client, and server dependencies:

```bash
git clone https://github.com/your-username/hospital-queue-management.git
cd hospital-queue-management
npm run install:all
```

### Environment Configuration

Copy the sanitized example environment files:

```bash
# Server configuration
cp server/.env.example server/.env

# Client configuration
cp client/.env.example client/.env
```

### Database Seeding

Seed the initial demo accounts (Admin, Receptionist, Doctor, Nurse):

```bash
npm run seed
```

### Starting the Services

Open two terminal sessions or run as background processes:

**Terminal 1 (Backend Server):**
```bash
npm run dev:server
# API listening at http://localhost:5000
# Health check: http://localhost:5000/api/health
```

**Terminal 2 (Frontend Client):**
```bash
npm run dev:client
# Frontend application available at http://localhost:5173
```

---

## Demo Accounts

All demo accounts are safely initialized with demo credentials via `npm run seed`:

| Role | Email | Password | Primary Capabilities |
|---|---|---|---|
| **Administrator** | `admin@mediqueue.test` | `Admin@123` | System oversight, department/staff CRUD, analytics reports, audit trail |
| **Receptionist** | `reception@mediqueue.test` | `Reception@123` | Patient registration, appointment booking, check-in, live queue operations |
| **Doctor** | `doctor@mediqueue.test` | `Doctor@123` | Today's queue, consultation notes, multi-item prescriptions |
| **Nurse** | `nurse@mediqueue.test` | `Nurse@123` | Queue observation, patient vital tracking, triage assistance |

*See [`docs/DEMO_ACCOUNTS.md`](docs/DEMO_ACCOUNTS.md) for complete details.*

---

## Automated Testing & Browser QA

### 1. Server Automated Test Suite (186/186 Passing)

The project includes 186 automated backend tests testing authentication, RBAC, appointment conflict prevention, queue priority preemption, consultations, prescriptions, audit logs, and settings:

```bash
npm run test:server
```

Output:
```
ℹ tests 186
ℹ suites 0
ℹ pass 186
ℹ fail 0
ℹ duration_ms 4187.2657
```

### 2. Frontend Code Quality & Build Verification

```bash
# Run client linter (Oxlint: 0 errors)
npm run lint:client

# Verify client production bundle build
npm run build:client
```

### 3. Real Browser QA Automation (Google Chrome)

To verify the live application end-to-end, run the automated Puppeteer QA suite. It launches a real Chrome instance, creates real test entities, validates cross-role permissions, tests priority queue preemption, exercises responsive mobile drawer navigation, and saves 24 verification screenshots:

```bash
npm run test:qa
```

---

## Live System Screenshots

All screenshots below were captured dynamically by the automated Chrome test suite against the running application:

| View | Screenshot | Description |
|---|---|---|
| **Login Screen** | ![Login](docs/screenshots/01_login_page.png) | Unified role-based authentication portal |
| **Admin Dashboard** | ![Admin Dashboard](docs/screenshots/02_admin_dashboard.png) | Live hospital statistics and operational overview |
| **Patient Profile** | ![Patient Profile](docs/screenshots/03_patient_profile.png) | Visit history, past consultations, and prescriptions |
| **Department Management** | ![Departments](docs/screenshots/04_departments_page.png) | Manage clinical departments and active status |
| **Room Management** | ![Rooms](docs/screenshots/05_rooms_page.png) | Examination rooms linked to departments |
| **Doctor Management** | ![Doctors](docs/screenshots/06_doctors_page.png) | Doctor assignment with automated login provisioning |
| **Staff & Users** | ![Staff](docs/screenshots/07_users_staff_page.png) | User account management, activation, and password resets |
| **Reports & Analytics** | ![Reports](docs/screenshots/08_reports_page.png) | Exportable analytics (CSV and print format) |
| **Audit Logs** | ![Audit Logs](docs/screenshots/09_audit_log_page.png) | Detailed immutable security log of all hospital mutations |
| **System Settings** | ![Settings](docs/screenshots/10_settings_page.png) | Global consultation duration and token rules |
| **Reception Dashboard** | ![Reception Dashboard](docs/screenshots/11_reception_dashboard.png) | Front-line arrival stats and emergency notifications |
| **Appointments Page** | ![Appointments](docs/screenshots/12_appointments_page.png) | Conflict-free appointment calendar with check-in button |
| **Check-in Token Modal** | ![Check-In](docs/screenshots/13_appointment_token_modal.png) | Instant token issuance with printable QR code slip |
| **Walk-in Token Modal** | ![Walk-In](docs/screenshots/14_walkin_token_modal.png) | Dynamic walk-in registration with priority allocation |
| **Live Queue Board** | ![Queue Board](docs/screenshots/15_queue_board.png) | Real-time queue board with Call Next, Skip, and Recall |
| **Doctor Dashboard** | ![Doctor Dashboard](docs/screenshots/16_doctor_dashboard.png) | Doctor's active patient list and consultation triggers |
| **Consultation & Rx Form**| ![Consultation](docs/screenshots/17_doctor_consultation_form.png) | Clinical diagnosis, clinical notes, and multi-drug prescription |
| **Nurse Dashboard** | ![Nurse Dashboard](docs/screenshots/18_nurse_dashboard.png) | Queue monitoring with strict RBAC boundaries |
| **Public Display Screen** | ![Display Screen](docs/screenshots/19_display_screen.png) | Unattended dark-mode TV display for waiting rooms |
| **Mobile Patient Tracking**| ![Tracking](docs/screenshots/20_patient_tracking.png) | Live mobile wait-time tracking via QR code |
| **Priority Queue Verified**| ![Priority Queue](docs/screenshots/22_priority_queue_verified.png) | Emergency preemption: `E-005` placed ahead of normal patients |
| **Mobile Drawer Navigation**| ![Mobile Drawer](docs/screenshots/23_mobile_drawer_open.png) | Fully responsive slide-out drawer on smartphone viewport |
| **Mobile Receptionist** | ![Mobile Dashboard](docs/screenshots/24_mobile_reception_dashboard.png) | Responsive front-line interface on mobile screen (390×844) |

---

## API Documentation

The REST API exposes clean, authenticated JSON endpoints under `/api`. All routes except `/api/health`, `/api/auth/login`, and `/api/public/queue*` require an `Authorization: Bearer <JWT>` header:

| Resource | Endpoints | Allowed Roles |
|---|---|---|
| **Health** | `GET /api/health` | Public |
| **Auth** | `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout` | Authenticated |
| **Patients** | `GET, POST /api/patients`, `GET, PUT /api/patients/:id` | Admin, Receptionist, Doctor, Nurse (read-only for clinicians) |
| **Appointments** | `GET, POST /api/appointments`, `PUT /api/appointments/:id` | Admin, Receptionist, Doctor |
| **Queue** | `GET /api/queue`, `POST /api/queue/token`, `POST /api/queue/call-next` | Admin, Receptionist, Doctor, Nurse |
| **Public Queue** | `GET /api/public/queue/display`, `GET /api/public/queue/track/:id` | Public |
| **Consultations** | `GET, POST /api/consultations`, `PUT /api/consultations/:id` | Doctor (scoped to assigned patients), Admin |
| **Prescriptions** | `GET, POST /api/prescriptions` | Doctor, Admin |
| **Infrastructure** | `/api/departments`, `/api/rooms`, `/api/doctors` | Admin-only writes, all roles read |
| **Reports** | `GET /api/reports/:type`, `GET /api/reports/types` | Admin-only |
| **Audit Logs** | `GET /api/audit-logs`, `GET /api/audit-logs/filter-options` | Admin-only |
| **Settings** | `GET, PUT /api/settings` | Admin-only |

*See [`docs/API.md`](docs/API.md) for full request/response schemas.*

---

## Security Considerations

1. **Authentication & Password Hashing:** All passwords are encrypted with `bcryptjs` using a salt work factor of 10. Passwords are never returned in user or doctor query responses.
2. **Strict RBAC Enforcement:** Every protected route uses layered middleware (`authenticateToken` + `authorizeRole(...)`). Cross-role privilege escalation is strictly forbidden and tested (e.g. nurses blocked from department creation with 403 Forbidden).
3. **No Credential Leakage:** Git repository excludes `.env`, `node_modules/`, `db.json`, and plaintext credential dumps via `.gitignore`.
4. **Data Isolation & Scoping:** Doctor queries are strictly filtered by `doctorId` or department assignment to prevent unauthorized cross-practitioner record modification.
5. **Zero-PII Public Endpoints:** Public display and patient tracking endpoints only return token numbers, room numbers, and anonymized queue status.

---

## Roadmap & Future Enhancements

- [ ] Real-time WebSocket / SSE push updates replacing polling.
- [ ] SMS / WhatsApp notification gateway for arrival alerts.
- [ ] Integration with HL7 / FHIR compliant electronic health record (EHR) systems.
- [ ] Billing & Invoicing module integrated with completed consultations.
- [ ] Native mobile apps (iOS & Android) for patients and clinical staff.

---

## License

This project is licensed under the [MIT License](LICENSE).
=======
# MediQueue-Hospital-Queue-Management
A full-stack Hospital Queue Management System with patient registration, appointment scheduling, priority-based queues, doctor consultations, and role-based dashboards.
>>>>>>> c3da4c37f0cdb86142a09fcbf57435b1a685eb89
