# API Contract (Frontend <-> Backend)

Date: 2026-06-02

## Base

- Base URL: `VITE_API_BASE_URL`
- JSON by default.
- Error shape (recommended):

```ts
interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}
```

Success shape used by frontend:

```ts
interface ApiResponse<T> {
  data: T;
  message?: string;
}
```

## Services

- `GET /api/services`
- `GET /api/services/{id}`
- `POST /api/services`
- `PATCH /api/services/{id}`
- `DELETE /api/services/{id}`

## Availability

- `GET /api/availability/dates?serviceId={id}&participants={n}`
- `GET /api/availability/slots?serviceId={id}&date={yyyy-mm-dd}`
- `POST /api/availability/check`

`/slots` response must include explicit unavailability reasons per slot.

## Bookings

- `GET /api/bookings`
- `GET /api/bookings/{id}`
- `POST /api/bookings`
- `PATCH /api/bookings/{id}/status`
- `PATCH /api/bookings/{id}/assign-trainer`
- `PATCH /api/bookings/{id}/assign-horses`
- `PATCH /api/bookings/{id}/trainer-status`

## Resources

- `GET /api/horses`
- `POST /api/horses`
- `PATCH /api/horses/{id}`
- `DELETE /api/horses/{id}`

- `GET /api/trainers`
- `POST /api/trainers`
- `PATCH /api/trainers/{id}`
- `DELETE /api/trainers/{id}`

## Rules and exceptions

- `GET /api/booking-rules`
- `POST /api/booking-rules`
- `PATCH /api/booking-rules/{id}`
- `DELETE /api/booking-rules/{id}`

- `GET /api/schedule/exceptions`
- `POST /api/schedule/exceptions`
- `PATCH /api/schedule/exceptions/{id}`
- `DELETE /api/schedule/exceptions/{id}`

## Notifications

- `GET /api/notifications?recipientRole=...&recipientId=...`
- `GET /api/notifications/unread-count?recipientId=...`
- `PATCH /api/notifications/{id}/read`

Trainer notification endpoints are not used by the current product flow. Trainer work is shown through the day/week schedule.

## Content

- `GET /api/site-content`
- `PATCH /api/site-content`
- `GET /api/gallery`
- `GET /api/reviews`
- `GET /api/contacts`
- `GET /api/rules-info`

## Auth

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Auth uses an HttpOnly `sid` cookie. Passwords are hashed on the backend.

## Admin

- `GET /api/admin/snapshot`
- `PATCH /api/admin/snapshot`

The snapshot endpoint is used by the admin editor to load and save editable site data, resources, booking rules, bookings, and staff accounts in one transaction-like operation.

## Manager

- `GET /api/manager/bookings`
- `GET /api/manager/bookings/{id}`
- `GET /api/manager/dashboard/stats`
- `GET /api/manager/attention-bookings`
- `GET /api/manager/workload/trainers`
- `GET /api/manager/workload/horses`
- `GET /api/manager/reference-data`
- `GET /api/manager/today-schedule`

## Trainer

- `GET /api/trainer/me`
- `GET /api/trainer/bookings`
- `GET /api/trainer/bookings/{id}`

## Required backend guarantees

1. Availability check on server is source of truth.
2. Booking creation must re-check availability server-side before write.
3. Staff passwords must be stored as hashes, not plain text.
4. Role-based authorization must be enforced server-side.
5. Trainer can access only assigned bookings.
