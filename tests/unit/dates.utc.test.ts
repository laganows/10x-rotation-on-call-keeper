import { describe, expect, it, vi } from "vitest";

import {
  addDaysToYyyyMmDd,
  diffDaysInclusive,
  isValidYyyyMmDd,
  parseYyyyMmDdToUtcMs,
  todayUtcYyyyMmDd,
  toYyyyMmDdUtc,
} from "@/lib/dates/utc";

describe("dates/utc", () => {
  it("parses valid YYYY-MM-DD and rejects invalid date values", () => {
    expect(parseYyyyMmDdToUtcMs("2024-02-29")).not.toBeNull();
    expect(parseYyyyMmDdToUtcMs("2024-02-30")).toBeNull();
    expect(parseYyyyMmDdToUtcMs("2024-13-01")).toBeNull();
    expect(parseYyyyMmDdToUtcMs("2024-2-01")).toBeNull();
  });

  it("validates dates with isValidYyyyMmDd", () => {
    expect(isValidYyyyMmDd("2024-01-01")).toBe(true);
    expect(isValidYyyyMmDd("2024-02-30")).toBe(false);
  });

  it("calculates inclusive day differences and guards invalid inputs", () => {
    expect(diffDaysInclusive("2024-01-01", "2024-01-01")).toBe(1);
    expect(diffDaysInclusive("2024-01-01", "2024-01-03")).toBe(3);
    expect(diffDaysInclusive("2024-01-01", "bad")).toBeNull();
  });

  it("adds days safely and preserves YYYY-MM-DD format", () => {
    expect(addDaysToYyyyMmDd("2024-12-31", 1)).toBe("2025-01-01");
    expect(addDaysToYyyyMmDd("bad", 1)).toBeNull();
  });

  it("formats UTC dates and uses UTC for today", () => {
    const date = new Date(Date.UTC(2024, 0, 5, 23, 59, 59));
    expect(toYyyyMmDdUtc(date)).toBe("2024-01-05");

    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2024, 3, 10, 12, 0, 0)));
    expect(todayUtcYyyyMmDd()).toBe("2024-04-10");
    vi.useRealTimers();
  });
});
