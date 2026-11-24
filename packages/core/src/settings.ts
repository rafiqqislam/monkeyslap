import { normalizeDomain } from "./domain";

export interface SiteLimit {
  domain: string;
  dailyMinutes: number;
  enabled: boolean;
}

export interface Settings {
  version: 1;
  limits: SiteLimit[];
  /** Which character pack to use (see @monkeyslap/characters). */
  characterId: string;
  /** Size multiplier for the character, 0.6–1.6. */
  characterScale: number;
  sound: boolean;
  /** After the user chooses to stay, how long until the next slap. */
  reslapMinutes: number;
}

/**
 * Limited from the moment the extension is installed. The extension asks Chrome
 * for access to these at install time, so keep this list in sync with
 * host_permissions in apps/extension/manifest.config.ts.
 */
export const DEFAULT_SITES = [
  "youtube.com",
  "facebook.com",
  "tiktok.com",
  "instagram.com",
  "reddit.com",
  "x.com",
] as const;

/** Shown as one-click buttons in the popup when not already in the list. */
export const SUGGESTED_SITES = DEFAULT_SITES;

export const DEFAULT_DAILY_MINUTES = 5;

/**
 * Until a person has been slapped once, every site slaps after this many minutes,
 * so new users see what MonkeySlap does right away. After that, normal limits apply.
 */
export const FIRST_SLAP_MINUTES = 1;

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  limits: DEFAULT_SITES.map((domain) => ({
    domain,
    dailyMinutes: DEFAULT_DAILY_MINUTES,
    enabled: true,
  })),
  characterId: "monkey",
  characterScale: 1,
  sound: true,
  reslapMinutes: 3,
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const num = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

export function clampMinutes(n: number): number {
  return clamp(Math.round(n), 1, 24 * 60);
}

/** Reads settings from storage, filling in defaults and repairing anything invalid. */
export function migrateSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const seen = new Set<string>();
  const limits: SiteLimit[] = [];
  // No list saved yet (a new install) → the default sites. A list the user has
  // emptied stays empty.
  const rawLimits: unknown[] = Array.isArray(r.limits) ? r.limits : DEFAULT_SETTINGS.limits;
  {
    for (const item of rawLimits) {
      const l = (item ?? {}) as Record<string, unknown>;
      const domain = typeof l.domain === "string" ? normalizeDomain(l.domain) : null;
      if (!domain || seen.has(domain)) continue;
      seen.add(domain);
      limits.push({
        domain,
        dailyMinutes: clampMinutes(num(l.dailyMinutes, DEFAULT_DAILY_MINUTES)),
        enabled: l.enabled !== false,
      });
    }
  }
  return {
    version: 1,
    limits,
    characterId:
      typeof r.characterId === "string" && r.characterId
        ? r.characterId
        : DEFAULT_SETTINGS.characterId,
    characterScale: clamp(num(r.characterScale, DEFAULT_SETTINGS.characterScale), 0.6, 1.6),
    sound: typeof r.sound === "boolean" ? r.sound : DEFAULT_SETTINGS.sound,
    reslapMinutes: clamp(Math.round(num(r.reslapMinutes, DEFAULT_SETTINGS.reslapMinutes)), 1, 60),
  };
}

export function upsertLimit(settings: Settings, limit: SiteLimit): Settings {
  const exists = settings.limits.some((l) => l.domain === limit.domain);
  const limits = exists
    ? settings.limits.map((l) => (l.domain === limit.domain ? limit : l))
    : [...settings.limits, limit];
  return { ...settings, limits };
}

export function removeLimit(settings: Settings, domain: string): Settings {
  return { ...settings, limits: settings.limits.filter((l) => l.domain !== domain) };
}

export function enabledDomains(settings: Settings): string[] {
  return settings.limits.filter((l) => l.enabled).map((l) => l.domain);
}
