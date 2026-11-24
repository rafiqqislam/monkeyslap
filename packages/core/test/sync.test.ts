import { describe, expect, it } from "vitest";
import { addSlap, addTime, daysAgo, pickSettingsSource, usageRows } from "../src";

const at = (y: number, mo: number, d: number, h = 0) => new Date(y, mo - 1, d, h).getTime();

describe("sync helpers", () => {
  const log = addSlap(
    addTime(
      addTime({}, "x.com", at(2026, 11, 20, 9), at(2026, 11, 20, 9) + 90_000),
      "youtube.com",
      at(2026, 11, 23, 9),
      at(2026, 11, 23, 9) + 300_000,
    ),
    "youtube.com",
    at(2026, 11, 23, 10),
  );

  it("flattens the usage log into rows, oldest first", () => {
    expect(usageRows(log)).toEqual([
      { day: "2026-11-20", domain: "x.com", ms: 90_000, slaps: 0 },
      { day: "2026-11-23", domain: "youtube.com", ms: 300_000, slaps: 1 },
    ]);
  });

  it("can limit rows to recent days", () => {
    expect(usageRows(log, daysAgo(at(2026, 11, 24, 12), 2)).map((r) => r.day)).toEqual(["2026-11-23"]);
  });

  it("keeps whichever settings were changed last", () => {
    expect(pickSettingsSource(100, null)).toBe("local");
    expect(pickSettingsSource(100, 50)).toBe("local");
    expect(pickSettingsSource(100, 100)).toBe("local");
    expect(pickSettingsSource(100, 200)).toBe("remote");
  });
});
