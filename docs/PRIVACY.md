# Privacy & Trust Model

This tool monitors browser activity, so its design leads with consent and control.
It is intended for people who install it to monitor **their own** activity — not for
covertly surveilling others.

## Guarantees built into the code

| Guarantee | Where |
| --- | --- |
| **Off until opt-in** — monitoring defaults to `false`; nothing is captured until the user clicks "enable". | `extension/src/lib/config.ts`, `popup.ts` |
| **Always-visible recording indicator** — a red `REC` badge shows on the toolbar while active. | `service-worker.ts` `updateBadge()` |
| **Domain exclusion list** — banking, login, and password-manager domains are excluded by default; the user can edit the list. | `config.ts` `DEFAULT_EXCLUDED_DOMAINS`, `exclusion.ts` |
| **Non-http never captured** — `chrome://`, extension pages, `file:`, and unparseable URLs are excluded. | `exclusion.ts` |
| **Active tab only** — only the focused tab is ever screenshotted, never background tabs. | `service-worker.ts` `captureNow()` |
| **No keystroke content** — the content script counts clicks/scrolls/keys but never reads values; key counting is suppressed entirely while a password field is focused. | `content-script.ts` |
| **Model told not to transcribe secrets** — the vision prompt instructs Claude to flag `containsSensitive` and keep summaries generic instead of copying sensitive data. | `vision/claude.ts` |
| **Privacy (text-only) mode** — raw screenshots are deleted right after the AI derives text; only the description is retained. | `worker.ts`, options toggle |
| **Export & delete** — one click exports all stored data as JSON, or deletes everything (rows + stored images). | `routes/data.ts`, popup/options |
| **Row-Level Security** — each user can only ever read/write their own rows. | `supabase/schema.sql` |
| **Tokens hashed at rest** — only the sha-256 of a bearer token is stored. | `lib/auth.ts` |

## Deliberately NOT built

- No covert/stealth mode, no hiding the recording indicator.
- No capture of other users or other people's machines.
- No third-party analytics or ad networks.
- The Anthropic API key is never shipped to the client.

## Operator responsibilities

If you deploy this for real users: publish a clear privacy policy, set a data
retention window and purge job, host the backend over HTTPS, restrict CORS to your
extension's origin, and comply with local law (GDPR/CCPA) — the export/delete
endpoints exist to support data-subject requests.
