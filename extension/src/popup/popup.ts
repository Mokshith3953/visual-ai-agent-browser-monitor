import { getSettings, updateSettings } from '../lib/settings';
import { requestDelete, requestExport } from '../lib/api';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const consentView = $('consentView');
const mainView = $('mainView');
const statusDot = $('statusDot');
const statusText = $('statusText');
const monitorToggle = $<HTMLInputElement>('monitorToggle');
const captureCount = $('captureCount');

async function render() {
  const s = await getSettings();
  const consented = Boolean(s.consentGrantedAt);

  consentView.hidden = consented;
  mainView.hidden = !consented;

  monitorToggle.checked = s.monitoring;
  const active = consented && s.monitoring;
  statusDot.classList.toggle('on', active);
  statusText.textContent = active
    ? `Recording every ${s.captureIntervalSec}s (active tab only).`
    : 'Paused — nothing is being captured.';

  captureCount.textContent = String(await capturesToday());
}

async function capturesToday(): Promise<number> {
  const { vaa_capture_count } = await chrome.storage.local.get('vaa_capture_count');
  return vaa_capture_count?.date === today() ? vaa_capture_count.count : 0;
}
const today = () => new Date().toISOString().slice(0, 10);

$('grantBtn').addEventListener('click', async () => {
  await updateSettings({ consentGrantedAt: Date.now(), monitoring: true });
  render();
});

monitorToggle.addEventListener('change', async () => {
  await updateSettings({ monitoring: monitorToggle.checked });
  render();
});

$('optionsBtn').addEventListener('click', () => chrome.runtime.openOptionsPage());

$('exportBtn').addEventListener('click', async () => {
  try {
    const res = await requestExport();
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    await chrome.downloads.download({ url, filename: `visual-ai-agent-export-${today()}.json` });
  } catch {
    alert('Export failed. Check that you are signed in (Settings) and the backend is running.');
  }
});

$('deleteBtn').addEventListener('click', async () => {
  if (!confirm('Delete ALL of your stored activity data? This cannot be undone.')) return;
  try {
    await requestDelete();
    await chrome.storage.local.set({ vaa_capture_count: { date: today(), count: 0 } });
    alert('All data deleted.');
    render();
  } catch {
    alert('Delete failed. Check your connection and try again.');
  }
});

render();
