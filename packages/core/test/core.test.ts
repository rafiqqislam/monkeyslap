import { describe, expect, it } from "vitest";
import {
  addSlap,
  addTime,
  dateKey,
  decide,
  DEFAULT_SETTINGS,
  formatDuration,
  hostFromUrl,
  limitStatus,
  matchDomain,
  migrateSettings,
  normalizeDomain,
  pruneUsage,
  removeLimit,
  sessionEnd,
  upsertLimit,
  usageFor,
  HEARTBEAT_MS,
  type Settings,
} from "../src";

const at = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0) =>
  new Date(y, mo - 1, d, h, mi, s).getTime();

describe("domains", () => {
  it("normalizes what users type", () => {
    expect(normalizeDomain("https://www.YouTube.com/watch?v=1")).toBe("youtube.com");
    expect(normalizeDomain("  reddit.com/r/all ")).toBe("reddit.com");
    expect(normalizeDomain("m.facebook.com:443")).toBe("m.facebook.com");
    expect(normalizeDomain("x.com")).toBe("x.com");
    expect(normalizeDomain("not a domain")).toBeNull();
    expect(normalizeDomain("localhost")).toBeNull();
    expect(normalizeDomain("")).toBeNull();
  });

  it("reads hosts only from web URLs", () => {
    expect(hostFromUrl("https://m.youtube.com/feed")).toBe("m.youtube.com");
    expect(hostFromUrl("chrome://newtab")).toBeNull();
    expect(hostFromUrl(undefined)).toBeNull();
    expect(hostFromUrl("garbage")).toBeNull();
  });

  it("matches subdomains but not look-alikes", () => {
    const domains = ["youtube.com", "x.com", "music.youtube.com"];
    expect(matchDomain("www.youtube.com", domains)).toBe("youtube.com");
    expect(matchDomain("music.youtube.com", domains)).toBe("music.youtube.com");
    expect(matchDomain("notyoutube.com", domains)).toBeNull();
    expect(matchDomain("box.com", domains)).toBeNull();
  });
});

describe("usage log", () => {
  it("adds time to the right day", () => {
    const log = addTime({}, "x.com", at(2026, 11, 23, 10), at(2026, 11, 23, 10, 5));
    expect(usageFor(log, "x.com", at(2026, 11, 23, 12)).ms).toBe(5 * 60_000);
  });

  it("splits a session that crosses midnight", () => {
    const log = addTime({}, "x.com", at(2026, 11, 23, 23, 50), at(2026, 11, 24, 0, 20));
    expect(log[dateKey(at(2026, 11, 23))]?.["x.com"]?.ms).toBe(10 * 60_000);
    expect(log[dateKey(at(2026, 11, 24))]?.["x.com"]?.ms).toBe(20 * 60_000);
  });

  it("counts slaps and does not mutate the input", () => {
    const before = {};
    const after = addSlap(before, "x.com", at(2026, 11, 23, 9));
    expect(before).toEqual({});
    expect(usageFor(after, "x.com", at(2026, 11, 23, 9)).slaps).toBe(1);
  });

  it("prunes old days", () => {
    let log = addTime({}, "x.com", at(2026, 1, 1, 9), at(2026, 1, 1, 10));
    log = addTime(log, "x.com", at(2026, 11, 22, 9), at(2026, 11, 22, 10));
    const pruned = pruneUsage(log, at(2026, 11, 23, 12), 90);
    expect(Object.keys(pruned)).toEqual([dateKey(at(2026, 11, 22))]);
  });
});

describe("sessions", () => {
  const session = { domain: "x.com", tabId: 1, startedAt: 1_000_000, lastSeenAt: 1_000_000 };

  it("counts up to now while check-ins are regular", () => {
    expect(sessionEnd(session, 1_000_000 + 45_000)).toBe(1_000_000 + 45_000);
  });

  it("stops at the last check-in after a long gap (sleep)", () => {
    const now = 1_000_000 + 2 * 60 * 60_000;
    expect(sessionEnd(session, now)).toBe(1_000_000 + HEARTBEAT_MS);
  });

  it("never goes negative if the clock moves backwards", () => {
    expect(sessionEnd(session, 500)).toBe(session.startedAt);
  });
});

describe("settings", () => {
  it("fills defaults for empty storage", () => {
    expect(migrateSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });

  it("starts new users with the seven default sites at 5 min", () => {
    expect(DEFAULT_SETTINGS.limits.map((l) => l.domain)).toEqual([
      "youtube.com",
      "facebook.com",
      "tiktok.com",
      "instagram.com",
      "reddit.com",
      "x.com",
      "linkedin.com",
    ]);
    expect(DEFAULT_SETTINGS.limits.every((l) => l.dailyMinutes === 5 && l.enabled)).toBe(true);
  });

  it("keeps an emptied list empty instead of restoring defaults", () => {
    expect(migrateSettings({ limits: [] }).limits).toEqual([]);
  });

  it("repairs bad values and drops duplicates", () => {
    const s = migrateSettings({
      limits: [
        { domain: "https://www.youtube.com", dailyMinutes: 0 },
        { domain: "youtube.com", dailyMinutes: 50 },
        { domain: "nope", dailyMinutes: 10 },
        { domain: "x.com", dailyMinutes: 15, enabled: false },
      ],
      characterScale: 9,
      reslapMinutes: -4,
      sound: "yes",
    });
    expect(s.limits).toEqual([
      { domain: "youtube.com", dailyMinutes: 1, enabled: true },
      { domain: "x.com", dailyMinutes: 15, enabled: false },
    ]);
    expect(s.characterScale).toBe(1.6);
    expect(s.reslapMinutes).toBe(1);
    expect(s.sound).toBe(true);
  });
});

describe("limits and rules", () => {
  const settings: Settings = upsertLimit(DEFAULT_SETTINGS, {
    domain: "x.com",
    dailyMinutes: 10,
    enabled: true,
  });
  const now = at(2026, 11, 23, 15);
  const veteran = { hasBeenSlapped: true };
  const newcomer = { hasBeenSlapped: false };

  it("slaps a new user after 1 minute, then uses the normal limit", () => {
    const log = addTime({}, "x.com", now - 61_000, now);
    const first = limitStatus(settings, log, "x.com", now, newcomer);
    expect(first?.limitMs).toBe(60_000);
    expect(first?.dailyLimitMs).toBe(10 * 60_000);
    expect(first?.firstSlap).toBe(true);
    expect(decide(first)?.interaction).toBe("slap");

    const after = limitStatus(settings, log, "x.com", now, veteran);
    expect(after?.limitMs).toBe(10 * 60_000);
    expect(after?.firstSlap).toBe(false);
    expect(decide(after)).toBeNull();
  });

  it("reports remaining time under the limit", () => {
    const log = addTime({}, "x.com", now - 4 * 60_000, now);
    const status = limitStatus(settings, log, "x.com", now, veteran);
    expect(status?.remainingMs).toBe(6 * 60_000);
    expect(status?.over).toBe(false);
    expect(decide(status)).toBeNull();
  });

  it("slaps when over, harder each time", () => {
    let log = addTime({}, "x.com", now - 11 * 60_000, now);
    expect(decide(limitStatus(settings, log, "x.com", now, veteran))).toEqual({
      interaction: "slap",
      intensity: 1,
      slapNumber: 1,
    });
    log = addSlap(addSlap(addSlap(log, "x.com", now), "x.com", now), "x.com", now);
    expect(decide(limitStatus(settings, log, "x.com", now, veteran))?.intensity).toBe(3);
  });

  it("ignores sites without an enabled limit", () => {
    expect(limitStatus(removeLimit(settings, "reddit.com"), {}, "reddit.com", now, veteran)).toBeNull();
  });
});

describe("format", () => {
  it("formats durations", () => {
    expect(formatDuration(42_000)).toBe("42 sec");
    expect(formatDuration(12 * 60_000)).toBe("12 min");
    expect(formatDuration(65 * 60_000)).toBe("1 h 5 min");
    expect(formatDuration(120 * 60_000)).toBe("2 h");
  });
});
