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

## Quick start

```bash
# 1. Backend
cd backend && cp .env.example .env   # fill in Supabase + Gemini keys
npm install && npm run dev

# 2. Supabase — apply the schema
#    (paste supabase/schema.sql into the Supabase SQL editor, or use the CLI)

# 3. Extension
cd extension && npm install && npm run build
#    Load extension/dist as an unpacked extension at chrome://extensions

# 4. Dashboard (optional)
cd dashboard && npm install && npm run dev
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full design and
[`docs/PRIVACY.md`](docs/PRIVACY.md) for the trust model.

## Security note

The Gemini API key **lives only on the backend**. It is never shipped inside the
extension. All vision inference runs server-side.
