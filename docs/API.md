# StoreListen API

Base URL: `http://localhost:3000/api` in development. The Vite dashboard proxies `/api` to the backend.

## Authentication

Send a Supabase access token:

```
Authorization: Bearer <access_token>
```

`requireAuth` validates the JWT with Supabase. Organization membership comes from user metadata or `organization_members`. Two-factor authentication is a **dashboard gate only** — desktop uploads keep working with a normal bearer token.

Password login (optional, needs `SUPABASE_ANON_KEY`):

```http
POST /api/auth/login
Content-Type: application/json

{ "email": "owner@example.com", "password": "secret" }
```

### Two-factor

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| POST | `/api/auth/2fa/setup` | yes | Start TOTP enrollment |
| POST | `/api/auth/2fa/verify` | yes | Confirm setup |
| POST | `/api/auth/2fa/disable` | yes | Turn 2FA off |
| GET | `/api/auth/2fa/status` | yes | `{ enabled, trusted }` |
| POST | `/api/auth/2fa/confirm` | yes | Dashboard OTP after password login |
| POST | `/api/auth/2fa/login` | no | Complete password+OTP login |
| POST | `/api/auth/2fa/backup` | no | Use a backup code |
| GET | `/api/auth/sessions` | yes | Active sessions |
| DELETE | `/api/auth/sessions` | yes | Revoke all |
| DELETE | `/api/auth/sessions/:id` | yes | Revoke one |
| POST | `/api/auth/password` | yes | Change password |

## Response envelope

Success:

```json
{
  "success": true,
  "message": "OK",
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "message": "User-friendly explanation.",
  "error": { "code": "UNAUTHENTICATED" }
}
```

Health endpoints are the exception: they return `{ ok, service, timestamp }` or a detailed checks object.

## Error codes

| Code | Typical status | Meaning |
| --- | --- | --- |
| `UNAUTHENTICATED` | 401 | Missing or invalid bearer token |
| `FORBIDDEN` | 403 | Role or store access denied |
| `VALIDATION_ERROR` | 400 | Zod / request body failed |
| `NOT_FOUND` | 404 | Resource missing |
| `RATE_LIMITED` | 429 | Too many requests |
| `LICENSE_NOT_FOUND` | 404 | Unknown license key |
| `LICENSE_INVALID` | 403 | Expired or inactive license |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

Stack traces are logged with Pino, not returned to clients.

## Health and monitoring

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | no | Liveness |
| GET | `/api/health/detailed` | no | Database, storage, AI config, cache size, memory |
| POST | `/api/health/client-error` | no | Dashboard ErrorBoundary reports |
| GET | `/api/sync/status` | no | Desktop reachability check |
| GET | `/api/version` | no | Latest/minimum desktop versions, force-update flag |

`X-Response-Time` is set on every response. Responses are gzip-compressed.

## Recordings and analysis

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/recordings` | Multipart audio upload (rate limited) |
| POST | `/api/recordings/batch` | Offline sync batch |
| GET | `/api/conversations/:id/analysis` | Gemini analysis |
| POST | `/api/conversations/:id/analyze` | Retry analysis |
| POST | `/api/conversations/:id/score` | Score the conversation |
| GET | `/api/conversations/:id/rules` | Rule results |
| POST | `/api/conversations/:id/detect-leads` | Create a follow-up from AI |
| GET | `/api/conversations/:id/translate` | `?language=ur` |

Conversation **lists** are read from Supabase on the dashboard, not this API.

## Rules, salesmen, CRM

| Method | Path |
| --- | --- |
| GET/POST | `/api/rules` |
| PUT/DELETE | `/api/rules/:id` |
| GET | `/api/salesmen/leaderboard` |
| GET | `/api/salesmen/:id/performance` |
| GET/POST | `/api/followups` |
| GET | `/api/followups/due-today` |
| PUT | `/api/followups/:id` |
| POST | `/api/followups/:id/complete` |
| POST | `/api/followups/:id/snooze` |
| POST | `/api/followups/:id/message` |
| DELETE | `/api/followups/:id` |
| GET | `/api/customers` |
| GET/PUT | `/api/customers/:id` |
| GET | `/api/notifications` |
| PUT | `/api/notifications/read-all` |
| PUT | `/api/notifications/:id/read` |
| DELETE | `/api/notifications/:id` |

## Stores and devices

| Method | Path | Role |
| --- | --- | --- |
| GET | `/api/stores` | any member |
| POST | `/api/stores` | admin |
| GET | `/api/stores/compare` | manager |
| GET | `/api/stores/:id/overview` | store access |
| PUT/DELETE | `/api/stores/:id` | admin |
| GET | `/api/devices` | manager |
| POST | `/api/devices/register` | any member |
| GET | `/api/activity` | any member |
| GET | `/api/me` | any member |
| GET | `/api/realtime/conversations` | SSE |

## Reports, export, retention

| Method | Path |
| --- | --- |
| GET | `/api/reports` |
| GET | `/api/reports/conversation/:id` |
| GET | `/api/reports/salesman/:id` |
| GET | `/api/reports/store` |
| GET/POST | `/api/reports/schedules` |
| GET | `/api/export/conversations` |
| GET | `/api/export/salesmen` |
| GET | `/api/export/followups` |
| GET | `/api/export/customers` |
| GET | `/api/retention/status` |
| POST | `/api/retention/cleanup` |
| PUT | `/api/retention/settings` |

## WhatsApp and SMS

WhatsApp Web is **off** unless `WHATSAPP_ENABLED=true`. Do not enable it in tests.

| Method | Path |
| --- | --- |
| GET | `/api/whatsapp/status` |
| POST | `/api/whatsapp/connect` |
| POST | `/api/whatsapp/send` |
| GET | `/api/whatsapp/templates` |
| GET | `/api/whatsapp/history` |
| POST | `/api/sms/send` |
| GET | `/api/communication/settings` |
| PUT | `/api/communication/settings` |

Messages respect customer consent and quiet hours (10 PM–9 AM).

## Security and backups

| Method | Path | Role |
| --- | --- | --- |
| GET | `/api/audit-logs` | manager |
| GET | `/api/audit-logs/export` | manager |
| GET | `/api/backup/status` | manager |
| POST | `/api/backup/run` | admin |
| POST | `/api/backup/restore` | owner |

Customer phones/emails may be stored as `enc:v1:` AES-256-GCM ciphertext when `ENCRYPTION_KEY` is set.

## License

Apply migration `012`. Activation is public (rate limited) so the desktop wizard can run before sign-in.

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| POST | `/api/license/activate` | no | `{ license_key, device_id }` or `{ trial: true, device_id }` |
| GET | `/api/license/status?key=` | no | Validity, plan, days left |
| POST | `/api/license/deactivate` | manager+ | `{ license_key }` |
| POST | `/api/license/renew` | manager+ | `{ license_key }` |
| POST | `/api/license/generate` | owner | `{ plan_type, organization_id?, max_* }` |

```http
POST /api/license/activate
Content-Type: application/json

{ "trial": true, "device_id": "desktop-1" }
```

```json
{
  "success": true,
  "message": "Trial started.",
  "data": {
    "license_key": "SL-A1B2-C3D4-E5F6-7890",
    "plan_type": "trial",
    "valid": true,
    "days_left": 14
  }
}
```

## Example: upload a recording

```http
POST /api/recordings
Authorization: Bearer eyJ...
Content-Type: multipart/form-data

audio=@clip.webm
duration=42
transcript=Customer asked about warranty
language=en
deviceId=desktop-1
```

```json
{
  "success": true,
  "message": "Recording queued.",
  "data": { "conversation_id": "..." }
}
```
