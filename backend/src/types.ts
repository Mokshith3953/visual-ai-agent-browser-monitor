/** Backend-side mirror of the extension contract + DB row shapes. */

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

export interface IncomingEvent {
  kind: string;
  url: string | null;
  title: string | null;
  origin: string | null;
  tabId: number | null;
  ts: number;
  interactions?: {
    clicks: number;
    scrolls: number;
    keypresses: number;
    activeMs: number;
  };
}

export interface IncomingCapture {
  url: string | null;
  title: string | null;
  origin: string | null;
  ts: number;
  imageBase64: string;
  width: number;
  height: number;
  phash: string;
  textOnly?: boolean;
}

export interface VisionResult {
  app: string;
  task: string;
  category: ActivityCategory;
  entities: string[];
  summary: string;
  containsSensitive: boolean;
}
