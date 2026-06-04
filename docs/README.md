# Project Documentation

This folder contains planning artifacts and the backend handoff package.

## Backend handoff package

1. `BACKEND_READINESS_AUDIT.md`
2. `API_CONTRACT.md`
3. `MOCK_TO_BACKEND_MIGRATION.md`
4. `ENV_SETUP.md`

## Existing planning docs

1. `BUSINESS_AUDIT.md`
2. `TASKS.md`
3. `BOOKING_BUSINESS_WORKFLOW_PLAN.md`
4. `FIXES_AND_IMPROVEMENTS_PLAN.md`
5. `CONTENT_EDITING_DEEP_DIVE.md`

## Integration baseline

- UI consumes only `src/services/api.ts`.
- API adapter switches by env:
  - `VITE_USE_MOCK_API=true` -> `mockApi`
  - `VITE_USE_MOCK_API=false` -> `backendApi`
- Base URL is `VITE_API_BASE_URL`.

