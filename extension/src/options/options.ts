import { getSettings, updateSettings } from '../lib/settings';
import { requestDelete, requestExport } from '../lib/api';
import { MAX_CAPTURE_INTERVAL_SEC, MIN_CAPTURE_INTERVAL_SEC } from '../lib/config';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const backendUrl = $<HTMLInputElement>('backendUrl');
const authToken = $<HTMLInputElement>('authToken');
const interval = $<HTMLInputElement>('interval');
const textOnly = $<HTMLInputElement>('textOnly');
const excluded = $<HTMLTextAreaElement>('excluded');
const saved = $('saved');

async function load() {
  const s = await getSettings();
  backendUrl.value = s.backendUrl;
  authToken.value = s.authToken ?? '';
  interval.value = String(s.captureIntervalSec);
  textOnly.checked = s.textOnly;
  excluded.value = s.excludedDomains.join('\n');
}

$('saveBtn').addEventListener('click', async () => {
  await updateSettings({
    backendUrl: backendUrl.value.trim() || 'http://localhost:8787',
    authToken: authToken.value.trim() || null,
    captureIntervalSec: Math.min(
      MAX_CAPTURE_INTERVAL_SEC,
      Math.max(MIN_CAPTURE_INTERVAL_SEC, Number(interval.value) || MIN_CAPTURE_INTERVAL_SEC),
    ),
    textOnly: textOnly.checked,
    excludedDomains: excluded.value
      .split('\n')
      .map((d) => d.trim())
      .filter(Boolean),
  });
  saved.hidden = false;
  setTimeout(() => (saved.hidden = true), 1500);
});

$('exportBtn').addEventListener('click', async () => {
  try {
    const res = await requestExport();
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    await chrome.downloads.download({
      url,
      filename: `visual-ai-agent-export-${new Date().toISOString().slice(0, 10)}.json`,
    });
  } catch {
    alert('Export failed — check the backend URL and token.');
  }
});

$('deleteBtn').addEventListener('click', async () => {
  if (!confirm('Delete ALL of your stored activity data? This cannot be undone.')) return;
  try {
    await requestDelete();
    alert('All data deleted.');
  } catch {
    alert('Delete failed — check the backend URL and token.');
  }
});

load();
