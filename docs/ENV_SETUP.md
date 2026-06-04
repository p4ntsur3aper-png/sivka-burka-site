# Environment Setup

## Local frontend with mock backend

Use:

```env
VITE_API_BASE_URL=http://localhost:8080/api
VITE_USE_MOCK_API=true
```

## Local frontend with real SQLite backend

Use:

```env
VITE_API_BASE_URL=http://localhost:8080/api
VITE_USE_MOCK_API=false
```

Start the local backend from the project root:

```bash
npm run backend:dev
```

It serves `http://localhost:8080/api` and stores local dev data in `backend/.data/sivka_burka.sqlite`.
If 8080 is busy, use another port and point Vite at it:

```powershell
$env:BACKEND_PORT='8090'
npm run backend:dev
```

```env
VITE_API_BASE_URL=http://localhost:8090/api
VITE_USE_MOCK_API=false
```

Run backend checks:

```powershell
npm.cmd --prefix backend test
```

## Notes

1. `VITE_USE_MOCK_API=false` uses `src/services/backendApi.ts` for public data, bookings, admin snapshot, manager screens, content, and auth.
2. Auth uses HttpOnly `sid` cookies, so frontend requests must keep `credentials: 'include'`.
3. Default seeded users: `admin/admin123`, `manager/manager123`, trainer selection with `trainer123`.
4. Frontend still expects `ApiResponse<T>` envelopes unless adapter maps responses.
