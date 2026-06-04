# Sivka-Burka Backend

REST backend for the existing Vite frontend.

It uses Node.js built-ins and SQLite through `node:sqlite`, so the diploma version has a real local database without an external DBMS. Use Node.js 22 LTS or newer.
Initial data is loaded from `src/data/mockData.ts` and persisted to `backend/.data/sivka_burka.sqlite`.

## Easiest Local Start

From the project root, run:

```powershell
npm run start:local
```

Or double-click `start-local.bat` on Windows.

## Run

```bash
npm run backend:dev
```

Default URL:

```text
http://localhost:8080/api
```

If port 8080 is busy:

```powershell
$env:BACKEND_PORT='8090'
npm run backend:dev
```

Frontend env for real backend mode:

```env
VITE_API_BASE_URL=http://localhost:8080/api
VITE_USE_MOCK_API=false
```

## Test

```bash
npm run backend:test
```

On Windows PowerShell with restricted scripts:

```powershell
npm.cmd --prefix backend test
```

## Implemented Areas

- Public content: services, site content, gallery, reviews, contacts, rules.
- Resources: horses, trainers, booking rules.
- Booking lifecycle: create, list, details, status, horse assignment, trainer assignment.
- Availability engine: dates, slots, server-side booking check.
- Staff accounts: administrator can change employee passwords.
- Auth: password hashing with `scrypt`, HttpOnly cookie sessions, role checks.
- SQLite persistence: domain tables, settings, staff users, sessions.

`node:sqlite` is marked experimental in Node 22, so Node prints a warning during tests and startup. For this local diploma build it keeps deployment simple; for production the same API can be moved to PostgreSQL.
