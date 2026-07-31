import { DEFAULT_SETTINGS, MAX_CAPTURE_INTERVAL_SEC, MIN_CAPTURE_INTERVAL_SEC, STORAGE_KEY } from './config';
import type { Settings } from './types';

/**
 * Clamps captureIntervalSec so every reader sees the same, honest value —
 * including settings saved before MIN_CAPTURE_INTERVAL_SEC existed.
 */
function normalize(s: Settings): Settings {
  return {
    ...s,
    captureIntervalSec: Math.min(
      MAX_CAPTURE_INTERVAL_SEC,
      Math.max(MIN_CAPTURE_INTERVAL_SEC, s.captureIntervalSec),
    ),
  };
}

/** Read settings from chrome.storage.local, merged over defaults. */
export async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return normalize({ ...DEFAULT_SETTINGS, ...(stored[STORAGE_KEY] ?? {}) });
}

/** Persist a partial settings patch and return the merged result. */
export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  return next;
}

/** Convenience: is monitoring both consented and enabled? */
export async function isActive(): Promise<boolean> {
  const s = await getSettings();
  return Boolean(s.consentGrantedAt) && s.monitoring;
}

/** Subscribe to settings changes. Returns an unsubscribe fn. */
export function onSettingsChanged(cb: (s: Settings) => void): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ) => {
    if (area === 'local' && changes[STORAGE_KEY]) {
      cb(normalize({ ...DEFAULT_SETTINGS, ...(changes[STORAGE_KEY].newValue ?? {}) }));
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
