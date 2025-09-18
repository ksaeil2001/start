# Tutor Loop Hub

Full-stack monorepo delivering the minimum viable loops between students, tutors, and parents.

## Overview
- **Apps**
  - `apps/api`: Node.js 20 + Express + Prisma API with PostgreSQL (docker-compose ready).
  - `apps/web`: Next.js 14 App Router + Tailwind UI providing one-click decision screens per role.
- **Domains covered**
  - S↔T: assignments, submissions, reviews, SLA tracking, session notes.
  - P↔T: calendar proposals/confirmations, attendance with signatures, invoices, reports.
  - S↔P: daily digest, encouragements, visibility controls, policy exception handling.
- **Security**: email/password auth with JWT and role-based guards.
- **Observability**: every status transition, policy application, signature, or financial event records an audit log.

## Prerequisites
- Node.js ≥ 20
- npm 9+
- Docker (for PostgreSQL via `docker-compose`)

## Quick start
```bash
# 1. Install dependencies
npm install

# 2. Start Postgres locally
docker-compose up -d

# 3. Apply database schema and seed baseline data (tutor/parent/student accounts)
npm run prisma:migrate
npm run prisma:seed

# 4. Generate Prisma client (runs automatically on install, re-run if needed)
npm run prisma:migrate

# 5. Run the API
npm run dev:api

# 6. Run the web app (in a separate terminal)
npm run dev:web
```
The API listens on `http://localhost:4000` by default. The web app runs on `http://localhost:3000`.

### Default credentials
| Role   | Email                | Password     |
|--------|----------------------|--------------|
| Tutor  | tutor@example.com    | password123  |
| Parent | parent@example.com   | password123  |
| Student| student@example.com  | password123  |

## Environment variables
Copy `apps/api/.env.example` to `.env` (or `.env.local`) and adjust as needed.

### API (`apps/api`)
- `DATABASE_URL` – connection string for PostgreSQL (defaults to docker-compose instance).
- `JWT_SECRET` – secret for signing JWT tokens.

### Web (`apps/web`)
Set optional environment variables to surface live API data instead of demo placeholders:
- `NEXT_PUBLIC_API_URL` – base URL of the API (defaults to `http://localhost:4000`).
- `NEXT_PUBLIC_STUDENT_ID`, `NEXT_PUBLIC_STUDENT_TOKEN`
- `NEXT_PUBLIC_TUTOR_TOKEN`
- `NEXT_PUBLIC_PARENT_TOKEN`

You can retrieve tokens by hitting `POST /auth/login` on the API.

## Testing
End-to-end integration tests (Supertest + Jest) cover the critical loops:
```bash
npm test
```
The Jest global setup runs Prisma migrations and seeds automatically before executing tests.

## Database utilities
- `npm run prisma:migrate` – applies migrations (`prisma migrate deploy`).
- `npm run prisma:seed` – re-seeds the database with baseline fixtures (assignment, submission, note, calendar proposals, policy).

## Front-end notes
- Tailwind is configured in `apps/web/tailwind.config.ts`.
- Role dashboards surface loading/error/empty states and keep actions to “one screen, one decision”.
- Demo data appears when live API tokens are not provided.

## Changelog
- Implemented Express API with Prisma schema covering assignments, submissions, sessions, calendar, attendance, invoices, reports, digests, encouragements, visibility, and policy exceptions.
- Added JWT auth, role-based middleware, audit logging helper, and Supertest scenario validating full S↔T, P↔T, S↔P loops.
- Provisioned docker-compose Postgres, Prisma migrations, and seed data (tutor/parent/student trio plus baseline artifacts).
- Delivered Next.js role dashboards, assignment/invoice detail pages, shared UI components, and safe API client with demo fallbacks.
- Documented setup, environment, testing, and change history in this README.
- Tightened API surface with validated resubmission payloads, parent/tutor-only invoice retrieval, and committed the initial Prisma migration for deploy automation.
