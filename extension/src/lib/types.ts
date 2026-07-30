/** Shared types for the extension <-> backend contract. */

export type ActivityKind =
  | 'tab_activated'
  | 'tab_updated'
  | 'window_focus'
  | 'window_blur'
  | 'navigation'
  | 'idle'
  | 'active'
  | 'interaction'; // aggregated clicks/scroll/keypress counts (never values)

/** Lightweight metadata event — cheap, sent frequently. Contains no screenshot. */
export interface ActivityEvent {
  kind: ActivityKind;
  url: string | null;
  title: string | null;
  /** Origin only, used for exclusion + grouping without leaking full URLs where not needed. */
  origin: string | null;
  tabId: number | null;
  /** epoch ms */
  ts: number;
  /** Optional aggregated interaction counters for `interaction` events. */
  interactions?: {
    clicks: number;
    scrolls: number;
    keypresses: number;
    /** ms of active engagement in this window */
    activeMs: number;
  };
}

/** A screenshot capture — heavier, sent on interval / significant change. */
export interface CapturePayload {
  url: string | null;
  title: string | null;
  origin: string | null;
  ts: number;
  /** base64 JPEG (no data: prefix) of the downscaled, compressed frame. */
  imageBase64: string;
  width: number;
  height: number;
  /** 64-bit perceptual hash (hex) computed client-side for cheap de-dupe. */
  phash: string;
}

/** Structured result Claude vision returns for a capture. */
export interface VisionResult {
  app: string; // e.g. "GitHub", "Gmail", "YouTube"
  task: string; // e.g. "reading a pull request diff"
  category: ActivityCategory;
  entities: string[]; // salient nouns: repo names, video titles, doc names
  summary: string; // one sentence
  containsSensitive: boolean; // model flags likely-sensitive content
}

export type ActivityCategory =
  | 'work'
  | 'communication'
  | 'social'
  | 'entertainment'
  | 'shopping'
  | 'learning'
  | 'news'
  | 'finance'
  | 'other';

export interface Settings {
  consentGrantedAt: number | null;
  /** master switch */
  monitoring: boolean;
  /** seconds between periodic screenshots while focused */
  captureIntervalSec: number;
  /** domains (suffix match) that are never captured */
  excludedDomains: string[];
  /** if true, backend stores only AI-derived text, discarding the raw image */
  textOnly: boolean;
  backendUrl: string;
  /** per-user token issued by the backend */
  authToken: string | null;
}
