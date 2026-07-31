import type { ActivityEvent } from '../lib/types';

/**
 * Content script: emits *aggregated* engagement signals only.
 *
 * Privacy: we count clicks / scrolls / keypresses and measure active time.
 * We NEVER read key values, input values, or page text. If focus enters a
 * password field we stop counting keypresses entirely for that period.
 */

const FLUSH_MS = 15_000;

let clicks = 0;
let scrolls = 0;
let keypresses = 0;
let activeMs = 0;
let lastActiveTick = Date.now();
let suppressKeys = false;

function tickActive() {
  const now = Date.now();
  if (document.visibilityState === 'visible' && document.hasFocus()) {
    activeMs += now - lastActiveTick;
  }
  lastActiveTick = now;
}

document.addEventListener('click', () => clicks++, { passive: true, capture: true });
document.addEventListener('scroll', () => scrolls++, { passive: true, capture: true });
document.addEventListener(
  'keydown',
  () => {
    if (!suppressKeys) keypresses++;
  },
  { passive: true, capture: true },
);

// Suppress key counting while a password/sensitive field is focused.
document.addEventListener(
  'focusin',
  (e) => {
    const el = e.target as HTMLElement | null;
    const type = (el as HTMLInputElement | null)?.type?.toLowerCase();
    const autoc = (el as HTMLInputElement | null)?.autocomplete?.toLowerCase() ?? '';
    suppressKeys =
      type === 'password' || autoc.includes('password') || autoc.includes('cc-number');
  },
  { passive: true },
);
document.addEventListener('focusout', () => (suppressKeys = false), { passive: true });

document.addEventListener('visibilitychange', () => {
  flush(); // send whatever was recorded before the tab goes out of view
  emit(document.visibilityState === 'visible' ? 'active' : 'idle');
});

function emit(kind: ActivityEvent['kind']) {
  const url = location.href;
  const event: ActivityEvent = {
    kind,
    url,
    title: document.title || null,
    origin: location.origin,
    tabId: null, // filled in by the service worker
    ts: Date.now(),
  };
  chrome.runtime.sendMessage({ type: 'activity-event', event }).catch(() => {});
}

function flush() {
  tickActive();
  if (clicks === 0 && scrolls === 0 && keypresses === 0 && activeMs === 0) return;
  const event: ActivityEvent = {
    kind: 'interaction',
    url: location.href,
    title: document.title || null,
    origin: location.origin,
    tabId: null,
    ts: Date.now(),
    interactions: { clicks, scrolls, keypresses, activeMs },
  };
  chrome.runtime.sendMessage({ type: 'activity-event', event }).catch(() => {});
  clicks = scrolls = keypresses = activeMs = 0;
}

setInterval(flush, FLUSH_MS);
window.addEventListener('pagehide', flush);
emit('navigation');
