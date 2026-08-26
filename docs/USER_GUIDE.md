# StoreListen user guide

StoreListen records in-store sales conversations on Windows, analyzes them with AI on the server, and shows scores, leads, and reports in a web dashboard.

## Installation

1. Apply every SQL file in `supabase/migrations/` (001–012) in the Supabase SQL editor, in order.
2. Optional demo rows: run `supabase/seed/demo.sql`.
3. Copy `backend/.env.example` to `backend/.env` and fill Supabase plus a **Google Gemini** key (`AIza…`). Never put that key in `/desktop` or `/frontend`.
4. Set `frontend/.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
5. Set `desktop/.env` with `VITE_BACKEND_URL=http://localhost:3000` (or your API origin).
6. Start the API: `cd backend && npm install && npm run dev`
7. Start the dashboard: `cd frontend && npm install && npm run dev`
8. Start the recorder: `cd desktop && npm install && npm run dev`

Production dashboard: `cd frontend && npm run build`. Production API: `cd backend && npm run build && npm start`.

Windows production: `cd desktop && npm run dist` produces `StoreListen-Setup-1.0.0.exe`. Silent: `StoreListen-Setup-1.0.0.exe /S`. Portable: `StoreListen-Portable-1.0.0.exe`. First launch walks through API URL, license/trial, device name, and a microphone test. Updates download from GitHub Releases when a newer version is published.

## Feature walkthrough

### Record (desktop)

1. Sign in so the app can cache a token for uploads.
2. Pick caption language (EN / UR / PA / AR / HI).
3. Start recording. Live captions stay on the device.
4. Stop. The clip is stored in IndexedDB if you are offline and uploads every 30 seconds when the API is reachable.

### Dashboard

- Today’s conversation count, high-intent leads, due follow-ups, and a weekly leaderboard.
- First visit shows a short onboarding card. Skip it anytime.
- Settings → Demo mode shows sample figures without writing to the database.
- Keyboard: Alt+1 Dashboard, Alt+2 Conversations, Alt+3 Follow-ups, Alt+4 Reports, Alt+5 Settings.

### Conversations

Search (debounced), filter by status/sentiment/salesman, infinite scroll, and open a recording for transcript, scores, rules, translation, and lead detection.

### Follow-ups and customers

High-intent talks become follow-ups. Complete, snooze, or send a suggested message. WhatsApp and SMS only go out after consent and outside quiet hours (10 PM–9 AM).

### Multi-store

Use the store selector in the header. Managers compare stores; admins add locations and assign people.

### Security

Settings → Security: enable authenticator 2FA, remember this browser for 30 days, review sessions, change password. Audit logs show exports and security events.

### Mobile / PWA

On a phone, install the dashboard from the browser prompt. A bottom tab bar appears under 768px. Offline, cached pages still open; new server writes wait until you are back online.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Sign-in form says missing env | `frontend/.env` needs both Supabase values, then restart Vite |
| Uploads stay pending | Backend running, `VITE_BACKEND_URL`, valid session token |
| Analysis stays queued | `GEMINI_API_KEY` must be a Google key, not an OpenAI `sk-` key |
| WhatsApp never connects | `WHATSAPP_ENABLED=true` and Chrome path; leave false in CI |
| 401 on every API call | Expired session — sign in again. 2FA is not required on uploads |
| Empty dashboard | Record once, or run `supabase/seed/demo.sql` and refresh |

## FAQ

**Does the desktop app call Gemini?** No. Audio and captions go to the Node API. The Gemini key stays on the server.

**Can I use StoreListen offline?** Yes on the recorder. The dashboard shows an offline banner and retries queued requests when the network returns.

**How do I reset the welcome tour?** Settings → Demo mode → Reset demo data and onboarding.

**How long are recordings kept?** Settings → retention days, then Run cleanup. Audio older than the window is archived.

**Is 2FA required for the Windows recorder?** No. 2FA only blocks the web dashboard until the OTP is entered.
