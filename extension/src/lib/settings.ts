import { DEFAULT_SETTINGS, STORAGE_KEY } from './config';
import type { Settings } from './types';

/** Read settings from chrome.storage.local, merged over defaults. */
export async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return { ...DEFAULT_SETTINGS, ...(stored[STORAGE_KEY] ?? {}) };
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
      cb({ ...DEFAULT_SETTINGS, ...(changes[STORAGE_KEY].newValue ?? {}) });
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
