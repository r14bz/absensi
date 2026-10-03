import { describe, it, expect } from "vitest";
import { getPeriod, getPeriodForDate, shiftPeriod, listDates, formatPeriodRange } from "../../src/lib/attendance/period";

describe("period 21-20", () => {
  it("getPeriod dinamai menurut bulan akhir", () => {
    expect(getPeriod(2026, 10)).toMatchObject({ start: "2026-09-21", end: "2026-10-20" });
    expect(getPeriod(2027, 1)).toMatchObject({ start: "2026-12-21", end: "2027-01-20" });
  });

  it("getPeriodForDate: tgl 20 masih periode bulan ini, tgl 21 pindah ke periode berikutnya", () => {
    expect(getPeriodForDate("2026-10-20")).toMatchObject({ year: 2026, month: 10 });
    expect(getPeriodForDate("2026-10-21")).toMatchObject({ year: 2026, month: 11 });
    expect(getPeriodForDate("2026-10-03")).toMatchObject({ year: 2026, month: 10 });
    expect(getPeriodForDate("2026-12-25")).toMatchObject({ year: 2027, month: 1 });
    expect(getPeriodForDate("2027-01-01")).toMatchObject({ year: 2027, month: 1 });
  });

  it("shiftPeriod melewati batas tahun", () => {
    expect(shiftPeriod(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftPeriod(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });

  it("listDates inklusif & berformat benar", () => {
    expect(listDates("2026-02-27", "2026-03-02")).toEqual(["2026-02-27", "2026-02-28", "2026-03-01", "2026-03-02"]);
  });

  it("formatPeriodRange", () => {
    expect(formatPeriodRange(getPeriod(2026, 10))).toBe("21 Sep 2026 – 20 Okt 2026");
  });
});
