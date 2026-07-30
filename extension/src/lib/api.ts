import type { ActivityEvent, CapturePayload } from './types';
import { getSettings } from './settings';

/** Thin client for the backend ingestion API. All calls carry the per-user token. */
async function authedFetch(path: string, body: unknown): Promise<Response> {
  const s = await getSettings();
  if (!s.authToken) throw new Error('not_authenticated');
  return fetch(new URL(path, s.backendUrl).toString(), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${s.authToken}`,
    },
    body: JSON.stringify(body),
  });
}

export async function sendEvents(events: ActivityEvent[]): Promise<void> {
  if (events.length === 0) return;
  const res = await authedFetch('/v1/events', { events });
  if (!res.ok) throw new Error(`events_failed_${res.status}`);
}

export async function sendCapture(capture: CapturePayload): Promise<void> {
  const s = await getSettings();
  const res = await authedFetch('/v1/captures', { ...capture, textOnly: s.textOnly });
  if (!res.ok) throw new Error(`capture_failed_${res.status}`);
}

/** Request a full export of the user's stored data (returns a download URL/JSON). */
export async function requestExport(): Promise<Response> {
  return authedFetch('/v1/data/export', {});
}

/** Request deletion of all stored data for this user. */
export async function requestDelete(): Promise<Response> {
  return authedFetch('/v1/data/delete', {});
}
