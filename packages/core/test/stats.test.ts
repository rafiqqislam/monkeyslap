import { describe, expect, it } from "vitest";
import { addSlap, addTime, lastDays, siteTotals } from "../src";

const at = (y: number, mo: number, d: number, h = 0) => new Date(y, mo - 1, d, h).getTime();
const min = 60_000;

describe("stats", () => {
  let log = addTime({}, "youtube.com", at(2026, 11, 24, 9), at(2026, 11, 24, 9) + 12 * min);
  log = addTime(log, "x.com", at(2026, 11, 24, 10), at(2026, 11, 24, 10) + 3 * min);
  log = addSlap(log, "youtube.com", at(2026, 11, 24, 11));
  log = addTime(log, "x.com", at(2026, 11, 20, 10), at(2026, 11, 20, 10) + 20 * min);
  log = addTime(log, "reddit.com", at(2026, 11, 1, 10), at(2026, 11, 1, 10) + 5 * min); // too old

  const days = lastDays(log, at(2026, 11, 24, 18), 7);

  it("returns 7 days ending today, filling empty days with zeros", () => {
    expect(days.map((d) => d.day)).toEqual([
      "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22", "2026-11-23", "2026-11-24",
    ]);
    expect(days[0]).toEqual({ day: "2026-11-18", ms: 0, slaps: 0, sites: [] });
  });

  it("totals each day and orders its sites by time", () => {
    const today = days[6]!;
    expect(today.ms).toBe(15 * min);
    expect(today.slaps).toBe(1);
    expect(today.sites.map((s) => s.domain)).toEqual(["youtube.com", "x.com"]);
  });

  it("totals sites across the days, ignoring older days", () => {
    expect(siteTotals(days)).toEqual([
      { domain: "x.com", ms: 23 * min, slaps: 0 },
      { domain: "youtube.com", ms: 12 * min, slaps: 1 },
    ]);
  });
});
