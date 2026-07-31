# Architecture

## Overview

A consent-based, self-installed Chrome extension captures the user's active tab on
a timer, ships each screenshot to a backend where **Gemini vision** interprets what
the user is doing, and stores structured activity in Postgres (Supabase) that a
dashboard reads back.

```
┌──────────────────────── CHROME EXTENSION (MV3, TypeScript) ─────────────────────────┐
│                                                                                      │
│  Content script          Service worker (background)          Popup + Options UI     │
│  • clicks/scroll/keys  →  • alarms + tab/window/idle events →  • consent + pause      │
│    (counts only,          • captureVisibleTab                  • exclusion list       │
│     password-safe)        • event buffer + batch flush         • export / delete      │
│                           • perceptual-hash de-dupe                                   │
│                                    │                                                  │
│                  Offscreen document (canvas: downscale → JPEG → aHash)                │
└────────────────────────────────────┼──────────────────────────────────────────────────┘
                                      │ HTTPS  Bearer <per-user token>
                                      ▼
┌──────────────────────── BACKEND (Node + Fastify + TypeScript) ───────────────────────┐
│  POST /v1/events     → insert metadata rows (fast)                                    │
│  POST /v1/captures   → upload image to Storage, insert `pending` capture, return fast │
│  GET  /v1/activity   → timeline + signed image URLs                                   │
│  GET  /v1/activity/summary → category rollups                                         │
│  POST /v1/data/export | /v1/data/delete                                               │
│  POST /v1/auth/register → issue a per-user bearer token                               │
│                              │ poll `pending`                                          │
│                              ▼                                                         │
│                  Vision worker ── analyzeScreenshot ──► Gemini (server-side key)       │
│                    forced JSON schema output → {app, task, category, entities, …}      │
└──────────────────────────────┬────────────────────────────────────────────────────────┘
                              ▼
┌──────────── SUPABASE ────────────┐          ┌──────── DASHBOARD (Next.js) ────────┐
│  Postgres (RLS per user)         │─────────►│  timeline cards • category chips     │
│   app_users, activity_events,    │          │  signed screenshot thumbnails        │
│   captures, sessions, summaries  │          └──────────────────────────────────────┘
│  Storage bucket `captures`       │
│   (private, per-user folders)    │
└──────────────────────────────────┘
```

## Why these choices

| Decision | Rationale |
| --- | --- |
| **API key server-side only** | The Gemini key never ships in the extension. All vision runs on the backend. This is the single most important security choice. |
| **`chrome.alarms`, not `setInterval`** | MV3 service workers are ephemeral; alarms survive worker suspension. |
| **Offscreen document for canvas** | The service worker has no DOM; image downscale/compress/hash needs a canvas context. |
| **Perceptual-hash de-dupe** | Skips visually near-identical frames (aHash + Hamming distance) so we don't pay to describe 1000 identical screens. |
| **Async vision queue** | Capture ingestion returns immediately (upload + `pending` row); vision runs in a poller, so the extension is never blocked on model latency. |
| **Images in Storage, not Postgres** | Blobs don't belong in a relational store; the DB keeps only the storage path + AI-derived fields. |
| **Row-Level Security** | Every table is scoped to its owner; the dashboard (anon key) can only ever read its own rows. The backend uses the service-role key and enforces `user_id` in code. |
| **Forced schema output for vision** | Gemini's `responseSchema` guarantees schema-valid JSON instead of parsing free-form text. |

## Data flow (one capture)

1. Service-worker alarm fires → active tab is focused and not excluded.
2. `chrome.tabs.captureVisibleTab` → PNG data URL.
3. Offscreen document downscales to ≤1280px, JPEG-compresses (~q0.6), computes an 8×8 aHash.
4. If the aHash is within Hamming distance 6 of the last sent frame → **skip**.
5. `POST /v1/captures` with the base64 JPEG + metadata + bearer token.
6. Backend uploads the image to `captures/<user_id>/<capture_id>.jpg`, inserts a `pending` row, returns.
7. The vision worker polls `pending`, downloads the image, calls Gemini, writes `{app, task, category, entities, summary, containsSensitive}` and marks `processed`.
8. In text-only mode the worker deletes the raw image and nulls `image_path`.
9. The dashboard reads `/v1/activity` and renders the timeline with short-lived signed URLs.

## Scaling notes

- Split the vision worker into its own process/container; it already claims work by polling `status = 'pending'`.
- Swap the polling loop for a real queue (Redis + BullMQ, or Supabase Realtime) at higher volume.
- Tune `VISION_MODEL` (`gemini-flash-latest` → `gemini-2.5-pro` for higher quality, or a pinned `gemini-2.x-flash` version) and the extension's `captureIntervalSec` to trade cost vs. resolution.
