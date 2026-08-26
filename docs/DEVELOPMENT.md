# StoreListen development

## Setup

```powershell
cd backend; npm install
cd ../frontend; npm install
cd ../desktop; npm install
```

Copy env files:

- `backend/.env` from `backend/.env.example`
- `frontend/.env` — `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, optional `VITE_BACKEND_URL`
- `desktop/.env` — `VITE_BACKEND_URL` only

Apply `supabase/migrations/001` through `012` in order. Optional: `supabase/seed/demo.sql`.

Run (three terminals):

```powershell
cd backend; npm run dev          # :3000
cd frontend; npm run dev         # :5173, proxies /api
cd desktop; npm run dev          # :5174 + Electron
```

## Architecture

```
desktop (Electron)  --multipart-->  backend (Express)
                                    |-- Supabase (Postgres + Storage)
                                    |-- Gemini (analysis only)
frontend (React/Vite) --JWT-->      backend + Supabase JS (lists)
```

- **Backend:** Express 5, TypeScript `nodenext`, Pino, Helmet, gzip, in-memory cache (`cache.service.ts`), analysis queue capped at 200 completed jobs.
- **Frontend:** React 19, TanStack Query (`staleTime` 60s), lazy-loaded routes, PWA, i18n (en/ur/ar + RTL).
- **Desktop:** Electron recorder, Web Speech captions, Dexie (`storelisten-offline`), sync every 30s. Do not change recorder behavior unless the task says so.

Auth isolation is application-level (service role bypasses RLS). Always filter by `organization_id`. Roles: `owner`, `admin`, `manager`, `salesman` (legacy `member` maps to admin).

## Tests

```powershell
cd backend; npm test
cd backend; npm run test:coverage
cd frontend; npm test
cd desktop; npm test
# Live dashboard only:
$env:E2E="1"; npx playwright test
```

Backend tests use Vitest + SuperTest and do not start WhatsApp/Puppeteer (`NODE_ENV=test`). Desktop tests cover language helpers, device id, Dexie, and offline queueing — they do not change app code.

## Contributing

- Keep Gemini and secrets out of `/desktop` and `/frontend`.
- Do not commit `.env`.
- New SQL goes in the next unused migration number (013+). Never overwrite 007–012.
- API responses use `{ success, message, data?, error? }`.
- Match existing TypeScript style; avoid drive-by refactors.
- PowerShell: chain with `;`, not `&&`, if an older host requires it.

## Deployment

1. Build API: `cd backend && npm run build && npm start`
2. Build dashboard: `cd frontend && npm run build` and serve `dist` (or any static host) with `/api` proxied to the API.
3. Set `CORS_ORIGIN` to a comma-separated allowlist.
4. Set `ENCRYPTION_KEY` (64 hex chars) if you want phones/emails encrypted at rest.
5. Keep `WHATSAPP_ENABLED=false` until you are ready to scan a QR on the server.
6. Nightly backups write encrypted JSON to the `backups` bucket at 03:00 and prune after 30 days.
7. Health: `GET /api/health` and `GET /api/health/detailed`.
8. Desktop version gate: `GET /api/version`.

## Windows installer

```powershell
cd desktop
npm install
npm run icons
npm run dist
```

Outputs in `desktop/release/`:

- `StoreListen-Setup-1.0.0.exe` — NSIS installer (`/S` silent, `/D=path` directory)
- `StoreListen-Portable-1.0.0.exe` — no install

Publish a GitHub Release (needs `GH_TOKEN` or Actions):

```powershell
# bump desktop/package.json version, then:
git tag v1.0.0
git push origin v1.0.0
```

The workflow `.github/workflows/release.yml` runs tests and `electron-builder --win --publish always`.

Code signing: buy an Authenticode cert, set `CSC_LINK` / `CSC_KEY_PASSWORD` (and `WIN_*` variants). Dev only: `desktop/scripts/generate-dev-cert.ps1`. Set `win.verifyUpdateCodeSignature` to `true` in `electron-builder.yml` after the public cert is in use.

Apply migration `012` for licenses. Gemini keys stay on the backend.
