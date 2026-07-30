import { defineManifest } from '@crxjs/vite-plugin';

/**
 * Manifest V3 definition.
 *
 * Permission rationale (principle of least privilege):
 * - tabs / activeTab : read tab URL + title, capture the visible tab
 * - scripting        : inject the content script for activity signals
 * - storage          : persist consent + settings locally
 * - alarms           : drive periodic capture (service workers cannot use setInterval reliably)
 * - offscreen        : run a DOM/canvas context to compress screenshots (SW has no DOM)
 * - idle             : pause capture when the user is away
 * host_permissions is <all_urls> because activity can happen on any site, BUT the
 * extension only ever captures the FOCUSED tab and respects the user's exclusion list.
 */
export default defineManifest({
  manifest_version: 3,
  name: 'Visual AI Agent — Activity Monitor',
  version: '0.1.0',
  description:
    'Consent-based self-monitoring: captures your active tab and uses Claude vision to log what you do.',
  minimum_chrome_version: '116',
  permissions: ['tabs', 'activeTab', 'scripting', 'storage', 'alarms', 'offscreen', 'idle'],
  host_permissions: ['<all_urls>'],
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/content-script.ts'],
      run_at: 'document_idle',
    },
  ],
  action: {
    default_popup: 'src/popup/popup.html',
    default_title: 'Visual AI Agent',
    default_icon: {
      '16': 'icons/icon-16.png',
      '48': 'icons/icon-48.png',
      '128': 'icons/icon-128.png',
    },
  },
  options_page: 'src/options/options.html',
  icons: {
    '16': 'icons/icon-16.png',
    '48': 'icons/icon-48.png',
    '128': 'icons/icon-128.png',
  },
});
