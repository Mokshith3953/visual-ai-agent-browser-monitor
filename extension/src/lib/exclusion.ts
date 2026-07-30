/** Privacy gate: decide whether a URL may be captured at all. */

export function originOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * A URL is excluded if:
 *  - it is not http(s) (chrome://, about:, file:, extension pages), or
 *  - its host ends with any excluded-domain suffix, or
 *  - the raw URL starts with an excluded scheme entry (e.g. "chrome://").
 */
export function isExcluded(url: string | null | undefined, excluded: string[]): boolean {
  if (!url) return true;

  for (const entry of excluded) {
    if (entry.includes('://') && url.startsWith(entry)) return true;
  }

  let scheme = '';
  let host = '';
  try {
    const u = new URL(url);
    scheme = u.protocol;
    host = u.hostname;
  } catch {
    return true; // unparseable → exclude by default
  }

  if (scheme !== 'http:' && scheme !== 'https:') return true;

  return excluded.some((entry) => {
    if (entry.includes('://')) return false; // scheme rules handled above
    return host === entry || host.endsWith('.' + entry);
  });
}
