import { describe, it, expect } from "vitest";
import {
  getWorkDateInTimezone,
  formatLocalTime,
  weekdayOfDateString,
  daysInMonth,
  zonedDateTimeToUtc,
} from "../../src/lib/timezone";

describe("timezone (Asia/Jakarta)", () => {
  it("work_date memakai tanggal Jakarta, bukan UTC (23:30 UTC = 06:30 hari berikutnya)", () => {
    expect(getWorkDateInTimezone(new Date("2026-09-28T23:30:00Z"))).toBe("2026-09-29");
    expect(getWorkDateInTimezone(new Date("2026-09-28T16:59:00Z"))).toBe("2026-09-28");
  });

  it("formatLocalTime menampilkan jam Jakarta", () => {
    expect(formatLocalTime(new Date("2026-09-28T01:05:00Z"))).toBe("08:05");
    expect(formatLocalTime(null)).toBe("--:--");
  });

  it("zonedDateTimeToUtc: 08:00 Jakarta = 01:00 UTC", () => {
    expect(zonedDateTimeToUtc("2026-09-28", "08:00").toISOString()).toBe("2026-09-28T01:00:00.000Z");
    expect(zonedDateTimeToUtc("2026-09-28", "00:30").toISOString()).toBe("2026-09-27T17:30:00.000Z");
  });

  it("weekday & daysInMonth", () => {
    expect(weekdayOfDateString("2026-10-02")).toBe(5); // Jumat
    expect(weekdayOfDateString("2026-10-04")).toBe(0); // Minggu
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
  });
});
