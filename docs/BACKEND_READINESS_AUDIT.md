# Backend Readiness Audit

Date: 2026-06-01

## Current status

- Frontend is functionally complete for demo flows.
- All UI data access now routes through `src/services/api.ts`.
- Mock mode is controlled via env:
  - `VITE_USE_MOCK_API=true` uses `mockApi`.
  - `VITE_USE_MOCK_API=false` requires backend adapter implementation.

## Frontend-only constraints found

1. Booking date window is hardcoded in `src/services/availabilityService.ts`:
   - `getAvailableDates` currently uses 21 days.
2. Availability decision is still frontend-authoritative in mock mode:
   - horse constraints;
   - trainer constraints;
   - closed days and working hours;
   - rest intervals.
3. Authentication is mock:
   - admin/manager/trainer credentials are frontend checks.
4. Data persistence is mock:
   - content/resources/bookings in browser storage.

## Required backend ownership

1. Availability engine:
   - dates, slots, reasons, conflicts.
2. Booking lifecycle:
   - create/confirm/reject/cancel/clarify.
3. Role auth and sessions:
   - `admin`, `manager`, `trainer`.
4. Content/media persistence:
   - services/gallery/contacts/rules/reviews.
5. Notification generation:
   - manager/trainer event feed.

## Frontend integration boundaries

1. Components must not call storage directly.
2. Components call only `src/services/api.ts`.
3. Backend adapter will replace mock API method-by-method.
4. UI messages for errors are ready; backend must return stable error payloads.

