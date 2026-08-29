# StoreListen Agent Guidelines

StoreListen is an AI-powered sales intelligence platform that captures in-store retail conversations, analyzes them with Google Gemini AI, and presents performance metrics, lead opportunities, and live coaching insights on a web dashboard.

---

## 1. System Architecture & Three-App Structure

```
+-------------------------------------------------------------+
|                      Desktop Client                         |
|                 (Electron + React + Vite)                   |
|  - In-store audio recording via MediaRecorder               |
|  - Real-time client speech recognition (Web Speech API)     |
|  - Live audio chunk streaming (POST /stream-chunk)          |
|  - Offline resilience & buffering with Dexie (IndexedDB)    |
|  - 30s background sync & Auto-updater (GitHub Releases)     |
+------------------------------+------------------------------+
                               |
                   HTTP / REST | (Bearer JWT)
                               v
+-------------------------------------------------------------+
|                       Backend API                           |
|                  (Node.js + Express 5)                      |
|  - Auth validation & RBAC (Supabase JWT)                    |
|  - Live chunk transcription & Sales suggestions (Gemini)    |
|  - Post-call comprehensive AI analysis queue (Gemini)       |
|  - Storage uploads, Database persistence, & Audit logging   |
|  - WhatsApp & Twilio SMS communication engines              |
|  - License validation & Desktop version gating              |
+---------------+-----------------------------+---------------+
                |                             |
                v                             v
+-------------------------------+  +--------------------------+
|      Supabase Services        |  |     Google Gemini AI     |
|  - PostgreSQL Database        |  |  - Audio analysis        |
|  - Storage Buckets (audio)    |  |  - Tone & Emotion        |
|  - Realtime subscriptions     |  |  - Real-time suggestions |
+-------------------------------+  +--------------------------+
                ^
                | Data / Lists
+---------------+---------------------------------------------+
|                    Frontend Dashboard                       |
|                     (React 19 + Vite)                       |
|  - Store managers & admin performance dashboard             |
|  - Conversation transcripts, rule evaluations & AI coaching |
|  - Follow-up CRM & Customer pipeline management             |
|  - PWA offline caching & multi-language i18n (EN/UR/AR/RTL) |
+-------------------------------------------------------------+
```

---

## 2. Hard Security Rules: API Keys & Secrets

1. **Gemini API Keys (`AIza...`)**:
   - MUST strictly reside on the backend in `backend/.env` (`GEMINI_API_KEY`).
   - **NEVER** expose, import, or bundle Gemini keys or server secrets in `/desktop` or `/frontend`.
2. **Client Isolation**:
   - The desktop app **never** calls Gemini directly; it communicates exclusively through authenticated endpoints on the Node.js API server (`VITE_BACKEND_URL`).
   - The web frontend only has access to public Supabase client tokens (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) and calls backend `/api` routes with a user JWT.
3. **Environment Files**:
   - Never commit `.env` files into source control.

---

## 3. Live-Streaming & Live-Suggestions Feature Pipeline

### Active Workflow:
1. **Initialize Conversation (`POST /api/conversations/start`)**:
   - Desktop starts a recording session and requests a new conversation ID from the backend with `status: "recording"`.
2. **Stream Audio Chunks (`POST /api/conversations/:id/stream-chunk`)**:
   - Desktop records audio in small time slices (6–8 seconds) and sends each chunk along with the running transcript context.
   - Backend calls Gemini for fast transcription delta.
   - Every $N$-th chunk (configured by `LIVE_SUGGESTION_EVERY_N_CHUNKS`, default `4`), Gemini generates a short, actionable live suggestion (max ~20 words) for the salesman.
   - Stream error resilience: Gemini errors on individual chunks return `{ transcriptDelta: "", error: true }` without crashing subsequent chunks.
3. **Finalize Recording (`POST /api/recordings`)**:
   - On recording stop, the final audio file is uploaded to the backend with the `conversationId`.
   - Backend attaches the audio, updates status to `"queued"`, and enqueues the conversation in the full analysis queue (`analysis-queue.ts`).

---

## 4. Development & Testing Commands

### Backend:
```powershell
cd backend
npm run typecheck
npm test
```

### Frontend:
```powershell
cd frontend
npm run typecheck
npm test
```

### Desktop:
```powershell
cd desktop
npm test
```
