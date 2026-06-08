# Backend Migration Status

## Result

The project now runs as a client-server application:

- frontend calls backend through `src/services/api.ts`;
- backend persists data in SQLite;
- initial/reset data lives in `backend/src/seed-data.js`;
- employee auth uses backend password hashes and HttpOnly cookie sessions;
- old browser keys are cleared on frontend startup.

## Runtime data flow

1. Public pages request services, content, reviews, contacts, gallery and rules from backend endpoints.
2. Booking form sends requests to `POST /api/bookings` and receives availability from backend checks.
3. Admin panel loads and saves `GET/PATCH /api/admin/snapshot`.
4. Manager and trainer workspaces use protected backend routes.
5. Notifications are loaded and marked as read through backend routes.

## Verification checklist

1. Run `npm run build`.
2. Run `npm.cmd --prefix backend test`.
3. Start the app with `npm run start:local`.
4. Confirm that new bookings remain after frontend restart.
5. Confirm that admin changes remain after frontend restart and are stored in SQLite.
