import type { VisionResult } from '../types.js';

export const CATEGORIES = [
  'work',
  'communication',
  'social',
  'entertainment',
  'shopping',
  'learning',
  'news',
  'finance',
  'other',
] as const;

/**
 * Normalizes raw (possibly malformed/partial) tool-call input from Claude into
 * a well-formed VisionResult. No network dependency, so it's unit-testable
 * against garbage model output without mocking the Anthropic client.
 */
export function normalizeVisionInput(
  input: Partial<VisionResult> | null | undefined,
): VisionResult {
  const category = input?.category;
  return {
    app: input?.app || 'Unknown',
    task: input?.task || 'Unknown activity',
    category: (CATEGORIES as readonly string[]).includes(category ?? '')
      ? (category as VisionResult['category'])
      : 'other',
    entities: Array.isArray(input?.entities) ? input!.entities.slice(0, 6) : [],
    summary: input?.summary ?? '',
    containsSensitive: Boolean(input?.containsSensitive),
  };
}
