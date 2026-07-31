# Visual AI Agent — Browser Activity Monitor

A **consent-based, self-installed Chrome extension** that visually monitors your own
browser activity. It periodically captures the visible tab, sends screenshots to a
backend where **Gemini vision** interprets *what you are actually doing* (not just the
URL), and stores structured activity in a database you own.

> ⚠️ **This is a transparent self-monitoring tool.** It requires explicit opt-in, shows an
> always-visible recording indicator, honors a per-domain exclusion list, never captures
> password fields, and provides one-click export/delete. It is **not** designed for covert
> surveillance of other people.

## Monorepo layout

| Package        | What it is                                                        |
| -------------- | ----------------------------------------------------------------- |
| `extension/`   | Manifest V3 Chrome extension (TypeScript + Vite) — the capture surface |
| `backend/`     | Fastify API + Gemini vision worker (TypeScript)                   |
| `dashboard/`   | Next.js dashboard to review your activity timeline                |
| `supabase/`    | Postgres schema, Row-Level Security, storage policies            |
| `docs/`        | Architecture & data-flow documentation                           |

## The pipeline

```
browse → extension detects activity (tab/URL/focus + interval)
       → screenshot captured & compressed (offscreen canvas)
       → POST to backend with per-user auth token
       → metadata stored immediately, screenshot enqueued
       → vision worker calls Gemini → structured activity JSON
       → written to Postgres (Supabase) → dashboard reads it
```

## Prerequisites

- Node.js 20+ and npm
- A [Supabase](https://supabase.com) project (free tier is fine)
- A [Gemini API key](https://aistudio.google.com/apikey) (free tier, no credit card)
- Google Chrome, for loading the extension

## Setup — step by step

### 1. Database (Supabase)

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run [`supabase/schema.sql`](supabase/schema.sql), then
   [`supabase/storage.sql`](supabase/storage.sql).
3. From **Project Settings → API**, copy the **Project URL** and the **service_role** key
   (not the anon key — the backend needs the service role to bypass RLS).

### 2. Backend

```bash
cd backend
cp .env.example .env
npm install
```

Fill in `backend/.env`:

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role key from step 1>
GEMINI_API_KEY=<key from aistudio.google.com/apikey>
```

Start it:

```bash
npm run dev            # starts the API + vision worker on :8787
```

It watches source files and auto-restarts on change. Leave it running in its own terminal.

### 3. Get an auth token

The extension authenticates to your backend with a per-user bearer token. Generate one
(returned exactly once — save it):

**macOS/Linux/Git Bash:**
```bash
curl -X POST http://localhost:8787/v1/auth/register \
  -H 'content-type: application/json' -d '{"email":"me@example.com"}'
# => { "userId": "...", "token": "..." }
```

**Windows PowerShell** (`curl` there is aliased to `Invoke-WebRequest`, which doesn't
take `-H`/`-d`, so use `Invoke-RestMethod` instead):
```powershell
Invoke-RestMethod -Uri http://localhost:8787/v1/auth/register -Method Post -ContentType "application/json" -Body '{"email":"me@example.com"}'
```

> Every call to `/v1/auth/register` creates a **brand-new, empty account**. Only run it
> once per person; if you already have a token saved in the extension, reuse it instead
> of generating a new one — otherwise your data gets split across two accounts.

### 4. Extension

```bash
cd extension
npm install
npm run build           # outputs extension/dist
```

1. Open `chrome://extensions`, enable **Developer mode** (top right).
2. Click **Load unpacked** → select `extension/dist`.
   (Already loaded? Click the reload icon on the extension's card instead, after rebuilding.)
3. Click the extension icon → **Settings** (or right-click the icon → Options).
4. Fill in:
   - **Backend URL**: `http://localhost:8787`
   - **Auth Token**: the token from step 3
   - Save.
5. Open the popup and toggle **Monitoring** on. A red `REC` badge appears on the toolbar
   icon while it's active; browse normally.

### 5. Dashboard (optional)

A Next.js UI to browse your captured activity timeline:

```bash
cd dashboard
cp .env.example .env    # set NEXT_PUBLIC_BACKEND_URL if not localhost
npm install
npm run dev             # http://localhost:3000
```

Paste the same auth token there to view your timeline.

## Verifying it works end-to-end

1. With monitoring on, browse a couple of normal (`http`/`https`) sites for ~1 minute.
2. Check the `captures` table in Supabase (or `GET /v1/activity` with
   `Authorization: Bearer <token>`) — rows should move from `pending` to `processed`,
   with `app`, `task`, `category`, and `summary` populated by Gemini within a few seconds.
3. The dashboard shows the same, with screenshot thumbnails.

If captures stay stuck on `pending`/`failed`, check the backend terminal for errors —
the most common cause is a missing/invalid `GEMINI_API_KEY`.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full design,
[`docs/PRIVACY.md`](docs/PRIVACY.md) for the trust model, and
[`docs/SETUP.md`](docs/SETUP.md) for production-hardening notes (CORS, retention,
running the vision worker as its own service).

## Security note

The Gemini API key **lives only on the backend**. It is never shipped inside the
extension. All vision inference runs server-side.
