# Backend Readiness Audit

Date: 2026-06-08

## Current status

- Frontend data access routes through `src/services/api.ts`.
- `src/services/api.ts` exports backend methods directly.
- Runtime frontend data no longer comes from browser seed files.
- SQLite is the source of truth for content, resources, bookings, staff accounts, sessions, and notifications.
- Initial/reset data is stored in `backend/src/seed-data.js`.

## Backend ownership

1. Availability engine:
   - dates, slots, reasons, conflicts.
2. Booking lifecycle:
   - create, confirm, reject, cancel, clarification, trainer assignment.
3. Role auth and sessions:
   - `admin`, `manager`, `trainer`.
4. Content/media persistence:
   - services, gallery, contacts, rules, reviews, content blocks, media folders and media assets.
5. Notification generation:
   - administrator and manager event feed.

## Frontend integration boundaries

1. Components use service modules, not browser storage.
2. Public pages call backend endpoints through `src/services/api.ts` and content repositories.
3. Admin panel saves one backend snapshot to SQLite.
4. Employee login uses backend password hashes and HttpOnly cookie sessions.
