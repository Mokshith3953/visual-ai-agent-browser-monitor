# Setup

## Prerequisites

- Node.js 20+
- A Supabase project (free tier is fine)
- A Gemini API key (free tier — get one at https://aistudio.google.com/apikey)

## 1. Database (Supabase)

1. Create a project at supabase.com.
2. In the SQL editor, run [`supabase/schema.sql`](../supabase/schema.sql) then
   [`supabase/storage.sql`](../supabase/storage.sql).
3. From Project Settings → API, copy the **Project URL** and the **service_role** key.

## 2. Backend

```bash
cd backend
cp .env.example .env
# Fill in:
#   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
#   GEMINI_API_KEY
npm install
npm run dev            # starts the API + vision worker on :8787
```

Register a user to get an auth token (returned exactly once):

```bash
curl -X POST http://localhost:8787/v1/auth/register \
  -H 'content-type: application/json' -d '{"email":"me@example.com"}'
# => { "userId": "...", "token": "..." }
```

On Windows PowerShell, `curl` is aliased to `Invoke-WebRequest` and doesn't accept `-H`/`-d`; use this instead:

```powershell
Invoke-RestMethod -Uri http://localhost:8787/v1/auth/register -Method Post -ContentType "application/json" -Body '{"email":"me@example.com"}'
```

## 3. Extension

```bash
cd extension
npm install
npm run build          # outputs extension/dist
```

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select `extension/dist`.
3. Open the extension's **Settings** (Options), paste your **Backend URL**
   (`http://localhost:8787`) and the **auth token** from step 2, then Save.
4. Open the popup → **enable monitoring**. A red `REC` badge appears; browse normally.

## 4. Dashboard (optional)

```bash
cd dashboard
cp .env.example .env    # set NEXT_PUBLIC_BACKEND_URL if not localhost
npm install
npm run dev            # http://localhost:3000
```

Paste the same auth token to view your activity timeline.

## Verifying end-to-end

1. With monitoring on, browse a couple of normal sites for ~1 minute.
2. `GET http://localhost:8787/v1/activity` with `Authorization: Bearer <token>` —
   you should see capture rows moving from `pending` to `processed` with `app`,
   `task`, `category`, and `summary` populated by Gemini.
3. The dashboard shows the same, with screenshot thumbnails.

## Production hardening (not enabled by default)

- Restrict `CORS_ORIGIN` to your extension's `chrome-extension://<id>` origin.
- Run the vision worker as a separate service.
- Add a retention/purge job for old captures.
- Put the backend behind HTTPS and a real auth provider (OAuth / magic link).
