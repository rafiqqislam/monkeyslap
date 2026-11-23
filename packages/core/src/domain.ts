const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/**
 * Turns whatever the user typed ("https://www.YouTube.com/watch?v=1", "youtube.com")
 * into a bare domain ("youtube.com"), or null if it isn't one.
 */
export function normalizeDomain(input: string): string | null {
  let s = input.trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^[a-z]+:\/\//, "");
  s = s.split(/[/?#]/)[0] ?? "";
  s = s.replace(/:\d+$/, "");
  s = s.replace(/^www\./, "");
  s = s.replace(/\.$/, "");
  return DOMAIN_RE.test(s) ? s : null;
}

/** Host of an http(s) URL, or null for anything else (chrome://, file://, invalid). */
export function hostFromUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return null;
  }
}

/** True when `host` is `domain` or one of its subdomains (m.youtube.com → youtube.com). */
export function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

/** The most specific domain in `domains` that `host` belongs to. */
export function matchDomain(host: string | null, domains: readonly string[]): string | null {
  if (!host) return null;
  let best: string | null = null;
  for (const d of domains) {
    if (hostMatches(host, d) && (!best || d.length > best.length)) best = d;
  }
  return best;
}

/** Chrome match patterns covering a domain and all of its subdomains. */
export function originPatterns(domain: string): string[] {
  return [`*://${domain}/*`, `*://*.${domain}/*`];
}
