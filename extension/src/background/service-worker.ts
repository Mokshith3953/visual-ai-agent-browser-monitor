import {
  ALARM_CAPTURE,
  ALARM_FLUSH,
  EVENT_BUFFER_LIMIT,
  PHASH_DUP_THRESHOLD,
} from '../lib/config';
import { getSettings, isActive, onSettingsChanged } from '../lib/settings';
import { isExcluded, originOf } from '../lib/exclusion';
import { hammingDistance } from '../lib/phash';
import { sendCapture, sendEvents } from '../lib/api';
import type { ActivityEvent, CapturePayload } from '../lib/types';

/**
 * Service worker — the orchestrator.
 * MV3 workers are ephemeral, so all scheduling uses chrome.alarms and all state
 * that must survive a restart lives in chrome.storage (settings) or is cheap to rebuild.
 */

const eventBuffer: ActivityEvent[] = [];
let lastPhash: string | null = null;
let userIdle = false;

// ---------------------------------------------------------------- lifecycle ---

chrome.runtime.onInstalled.addListener(async () => {
  await reconcileAlarms();
  await updateBadge();
});
chrome.runtime.onStartup.addListener(reconcileAlarms);

onSettingsChanged(async () => {
  await reconcileAlarms();
  await updateBadge();
});

async function reconcileAlarms() {
  const s = await getSettings();
  await chrome.alarms.clear(ALARM_CAPTURE);
  await chrome.alarms.clear(ALARM_FLUSH);
  if (s.consentGrantedAt && s.monitoring) {
    chrome.alarms.create(ALARM_CAPTURE, {
      periodInMinutes: Math.max(0.25, s.captureIntervalSec / 60),
    });
    chrome.alarms.create(ALARM_FLUSH, { periodInMinutes: 0.5 });
  }
}

// ------------------------------------------------------------------- events ---

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type === 'activity-event') {
    const event = msg.event as ActivityEvent;
    event.tabId = sender.tab?.id ?? event.tabId;
    bufferEvent(event);
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab) return;
  bufferEvent(metaEvent('tab_activated', tab));
});

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' || changeInfo.url) {
    bufferEvent(metaEvent('tab_updated', tab));
  }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  const blurred = windowId === chrome.windows.WINDOW_ID_NONE;
  bufferEvent({
    kind: blurred ? 'window_blur' : 'window_focus',
    url: null,
    title: null,
    origin: null,
    tabId: null,
    ts: Date.now(),
  });
});

if (chrome.idle) {
  chrome.idle.setDetectionInterval(60);
  chrome.idle.onStateChanged.addListener((state) => {
    userIdle = state !== 'active';
    bufferEvent({
      kind: userIdle ? 'idle' : 'active',
      url: null,
      title: null,
      origin: null,
      tabId: null,
      ts: Date.now(),
    });
  });
}

function metaEvent(kind: ActivityEvent['kind'], tab: chrome.tabs.Tab): ActivityEvent {
  return {
    kind,
    url: tab.url ?? null,
    title: tab.title ?? null,
    origin: originOf(tab.url),
    tabId: tab.id ?? null,
    ts: Date.now(),
  };
}

function bufferEvent(event: ActivityEvent) {
  eventBuffer.push(event);
  if (eventBuffer.length >= EVENT_BUFFER_LIMIT) void flushEvents();
}

async function flushEvents() {
  if (eventBuffer.length === 0) return;
  if (!(await isActive())) {
    eventBuffer.length = 0;
    return;
  }
  const batch = eventBuffer.splice(0, eventBuffer.length);
  try {
    await sendEvents(batch);
  } catch (err) {
    // requeue on failure (bounded) so a transient outage doesn't lose everything
    if (eventBuffer.length < EVENT_BUFFER_LIMIT * 4) eventBuffer.unshift(...batch);
    console.warn('flushEvents failed', err);
  }
}

// ------------------------------------------------------------------ capture ---

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_FLUSH) return void flushEvents();
  if (alarm.name === ALARM_CAPTURE) return void captureNow();
});

async function captureNow() {
  if (userIdle) return;
  const s = await getSettings();
  if (!s.consentGrantedAt || !s.monitoring) return;

  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.url || tab.id === undefined || tab.windowId === undefined) return;
  if (isExcluded(tab.url, s.excludedDomains)) return;

  let dataUrl: string;
  try {
    dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
  } catch {
    return; // e.g. capturing a protected page — skip silently
  }

  const processed = await processInOffscreen(dataUrl);
  if (!processed) return;

  // De-dupe: skip frames that are visually ~identical to the last one we sent.
  if (lastPhash && hammingDistance(processed.phash, lastPhash) <= PHASH_DUP_THRESHOLD) {
    return;
  }
  lastPhash = processed.phash;

  const payload: CapturePayload = {
    url: tab.url,
    title: tab.title ?? null,
    origin: originOf(tab.url),
    ts: Date.now(),
    imageBase64: processed.imageBase64,
    width: processed.width,
    height: processed.height,
    phash: processed.phash,
  };
  try {
    await sendCapture(payload);
    await incrementCaptureCount();
  } catch (err) {
    console.warn('sendCapture failed', err);
  }
}

async function incrementCaptureCount() {
  const today = new Date().toISOString().slice(0, 10);
  const { vaa_capture_count } = await chrome.storage.local.get('vaa_capture_count');
  const count = vaa_capture_count?.date === today ? vaa_capture_count.count + 1 : 1;
  await chrome.storage.local.set({ vaa_capture_count: { date: today, count } });
}

// --------------------------------------------------------------- offscreen ---

async function ensureOffscreen() {
  const has = await chrome.offscreen.hasDocument?.();
  if (has) return;
  await chrome.offscreen.createDocument({
    url: 'src/offscreen/offscreen.html',
    reasons: [chrome.offscreen.Reason.DOM_SCRAPING],
    justification: 'Downscale and compress screenshots off the service worker thread.',
  });
}

async function processInOffscreen(dataUrl: string): Promise<CaptureProcessed | null> {
  await ensureOffscreen();
  const res = await chrome.runtime.sendMessage({
    target: 'offscreen',
    type: 'process-capture',
    dataUrl,
  });
  if (!res?.ok) return null;
  return res as CaptureProcessed;
}

interface CaptureProcessed {
  imageBase64: string;
  width: number;
  height: number;
  phash: string;
}

// --------------------------------------------------------------- badge/UI ---

async function updateBadge() {
  const active = await isActive();
  await chrome.action.setBadgeText({ text: active ? 'REC' : '' });
  await chrome.action.setBadgeBackgroundColor({ color: active ? '#dc2626' : '#00000000' });
}
