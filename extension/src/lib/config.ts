import type { Settings } from './types';

export const STORAGE_KEY = 'vaa_settings';

/**
 * Domains excluded by default. These are common sensitive categories the tool
 * should never capture unless the user explicitly removes them.
 */
export const DEFAULT_EXCLUDED_DOMAINS = [
  'chrome://',
  'accounts.google.com',
  'login.microsoftonline.com',
  'paypal.com',
  'bankofamerica.com',
  'chase.com',
  'wellsfargo.com',
  '1password.com',
  'lastpass.com',
];

export const DEFAULT_SETTINGS: Settings = {
  consentGrantedAt: null,
  monitoring: false, // OFF until the user opts in
  captureIntervalSec: 20,
  excludedDomains: [...DEFAULT_EXCLUDED_DOMAINS],
  textOnly: false,
  backendUrl: 'http://localhost:8787',
  authToken: null,
};

export const ALARM_CAPTURE = 'vaa_capture';
export const ALARM_FLUSH = 'vaa_flush';

/** Max events buffered before a forced flush. */
export const EVENT_BUFFER_LIMIT = 25;

/** Downscale target for screenshots before upload (long edge, px). */
export const CAPTURE_MAX_EDGE = 1280;
export const CAPTURE_JPEG_QUALITY = 0.6;

/**
 * Hamming distance threshold on the 64-bit perceptual hash below which two frames
 * are considered "the same scene" and the newer one is skipped (cost control).
 */
export const PHASH_DUP_THRESHOLD = 6;
