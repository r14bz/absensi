import { describe, it, expect } from "vitest";
import { buildMonth } from "../../src/lib/server/month";

describe("buildMonth (periode pembukuan 21 s/d 20)", () => {
  const rec = (d: string, inAt: string | null, net = 480, ot = 0, shift: "PAGI" | "SORE" | "MALAM" | null = "PAGI") => ({
    work_date: d, status: "PRESENT" as const, check_in_at: inAt, check_out_at: inAt ? inAt : null,
    net_work_minutes: net, overtime_minutes: ot, shift,
  });

  it("periode Oktober 2026 = 21 Sep s/d 20 Okt (30 hari)", () => {
    const { days } = buildMonth({ year: 2026, month: 10, today: "2026-12-31", records: [], holidays: [], approvedLeaves: [] });
    expect(days[0]!.date).toBe("2026-09-21");
    expect(days[days.length - 1]!.date).toBe("2026-10-20");
    expect(days).toHaveLength(30);
  });

  it("periode Januari melewati pergantian tahun (21 Des – 20 Jan)", () => {
    const { days } = buildMonth({ year: 2027, month: 1, today: "2027-12-31", records: [], holidays: [], approvedLeaves: [] });
    expect(days[0]!.date).toBe("2026-12-21");
    expect(days[days.length - 1]!.date).toBe("2027-01-20");
    expect(days).toHaveLength(31);
  });

  it("periode Maret 2028 memuat 29 Feb (tahun kabisat)", () => {
    const { days } = buildMonth({ year: 2028, month: 3, today: "2028-12-31", records: [], holidays: [], approvedLeaves: [] });
    expect(days[0]!.date).toBe("2028-02-21");
    expect(days.some((d) => d.date === "2028-02-29")).toBe(true);
  });

  it("menghitung absen dari kalender & rekap per shift", () => {
    // Periode Okt 2026 mulai 21 Sep (Sen). 26-27 Sep = akhir pekan. Hari ini = 24 Sep.
    const { summary, days } = buildMonth({
      year: 2026, month: 10, today: "2026-09-24",
      records: [
        rec("2026-09-21", "2026-09-21T01:00:00Z", 480, 60, "PAGI"),
        rec("2026-09-22", "2026-09-22T08:00:00Z", 480, 0, "SORE"),
      ],
      holidays: ["2026-09-23"],
      approvedLeaves: [{ leave_date: "2026-09-24", leave_type: "SICK" }],
    });
    expect(summary.presentDays).toBe(2);
    expect(summary.shiftDays).toEqual({ PAGI: 1, SORE: 1, MALAM: 0 });
    expect(summary.holidayDays).toBe(1);
    expect(summary.sickDays).toBe(1);
    expect(summary.absentDays).toBe(0);
    expect(summary.totalOvertimeMinutes).toBe(60);
    expect(days.find((d) => d.date === "2026-09-26")?.status).toBeNull(); // belum terjadi
  });

  it("hari kerja tanpa aktivitas yang sudah lewat = ABSENT; akhir pekan = DAY_OFF", () => {
    const { summary, days } = buildMonth({
      year: 2026, month: 10, today: "2026-09-28", records: [], holidays: [], approvedLeaves: [],
    });
    expect(days.find((d) => d.date === "2026-09-26")?.status).toBe("DAY_OFF");
    expect(summary.absentDays).toBe(6); // 21-25 Sep (5) + 28 Sep
  });
});
