# Environment Setup

## Local frontend with SQLite backend

Use:

```env
VITE_API_BASE_URL=http://localhost:8080/api
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
```

Run backend checks:

```powershell
npm.cmd --prefix backend test
```

## Notes

1. The frontend uses `src/services/backendApi.ts` through `src/services/api.ts`.
2. Auth uses HttpOnly `sid` cookies, so frontend requests keep `credentials: 'include'`.
3. Initial SQLite content is loaded from `backend/src/seed-data.js`.
4. Default seeded users: `admin/admin123`, `manager/manager123`, trainer login with `trainer123`.
