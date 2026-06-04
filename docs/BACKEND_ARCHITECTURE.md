# Backend Architecture

## Purpose

The backend supports a horse club web application with four workflows:

- client booking without login;
- administrator content and resource management;
- manager booking control, calendar, workload, and notifications;
- trainer schedule and assigned booking response.

## Runtime

- Node.js HTTP server: `backend/src/server.js`
- SQLite persistence: `backend/src/store.js`
- Availability rules: `backend/src/availability.js`
- Password and token utilities: `backend/src/security.js`
- Seed source: `src/data/mockData.ts`

The local database file is `backend/.data/sivka_burka.sqlite`. It is ignored by git.

## Database Schema

SQLite tables:

- `app_meta` - schema version and initialization flags.
- `app_settings` - single-record settings such as site content, contacts, and rules page data.
- `services`, `horses`, `trainers`, `booking_rules`, `bookings`, `reviews`, `gallery_items` - main domain entities.
- `content_blocks`, `content_revisions`, `media_folders`, `media_assets` - editable content and media.
- `notifications` - administrator and manager notification events.
- `staff_users` - employee accounts with role, login, display name, trainer link, password hash, and notification settings.
- `sessions` - HttpOnly cookie sessions stored as SHA-256 token hashes.

Most domain tables keep the full entity payload as JSON plus stable `id` and `sort_order`. This keeps compatibility with the existing frontend contract while moving persistence from browser storage and JSON files into a real SQL database. Staff users, sessions, and notifications use dedicated columns because they are security-sensitive and frequently filtered.

## Auth Model

Passwords are never stored in plain text on the backend. `backend/src/security.js` hashes them with `crypto.scryptSync` and per-user salts.

Login endpoint:

```text
POST /api/auth/login
```

Successful login sets an HttpOnly `sid` cookie. The server stores only the hash of that token in `sessions`.

Roles:

- `admin` can edit site data, staff accounts, resources, bookings, and content.
- `manager` can work with bookings, analytics, calendar, and manager notifications.
- `trainer` can read and update only assigned bookings. Trainer notifications are disabled; schedule is the source of truth.

## Key API Groups

- `GET /api/services`, `GET /api/site-content`, `GET /api/gallery`, `GET /api/reviews`, `GET /api/contacts`, `GET /api/rules-info`
- `GET /api/availability/dates`, `GET /api/availability/slots`, `POST /api/availability/check`
- `POST /api/bookings`
- `GET/PATCH /api/bookings/:id/*`
- `GET/PATCH /api/admin/snapshot`
- `GET /api/manager/*`
- `GET /api/trainer/*`
- `GET/PATCH /api/notifications/*`

Responses use the existing frontend envelope:

```json
{ "data": {} }
```

## Tests

Backend tests are in `backend/test/backend.test.js`.

They verify:

- password hash verification;
- rejection of anonymous admin access;
- seeded administrator login;
- protected admin snapshot access;
- manager role restriction.

Run:

```powershell
npm.cmd --prefix backend test
```

## Production Notes

`node:sqlite` is currently experimental in Node 22, but it is useful for a self-contained diploma deployment. If the project is deployed to production, the same REST contract can be kept while replacing the persistence layer with PostgreSQL and an ORM or query builder.
