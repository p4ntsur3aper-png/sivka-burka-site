# Mock to Backend Migration

## Goal

Switch from browser-storage mock backend to real API without page rewrites.

## Current architecture

- UI calls `src/services/api.ts`.
- `api.ts` routes calls to `mockApi` when `VITE_USE_MOCK_API=true`.
- Backend mode is blocked intentionally until adapters are implemented.

## Migration steps

1. Implement backend adapter module:
   - `src/services/backendApi.ts`
2. Wire `api.ts`:
   - if mock mode -> `mockApi`
   - else -> `backendApi`
3. Keep method signatures identical to current `api.ts` exports.
4. Validate flows:
   - services/catalog/details;
   - booking form;
   - manager calendar/bookings;
   - trainer schedule/details;
   - notifications.

## Non-negotiable backend parity

1. Slot reasons must be returned as plain user-readable strings.
2. Booking statuses and trainer statuses must match frontend enums.
3. Date/time format must stay ISO-compatible with current UI.
4. IDs must remain stable string values.

## Cutover checklist

1. Set `VITE_USE_MOCK_API=false`.
2. Set `VITE_API_BASE_URL=<backend>/api`.
3. Smoke test all pages.
4. Disable demo credentials and switch to backend auth.

