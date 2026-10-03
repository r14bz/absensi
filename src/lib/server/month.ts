import { getWorkDateInTimezone, weekdayOfDateString } from "@/lib/timezone";
import { getPeriod, listDates } from "@/lib/attendance/period";
import { resolveAttendanceStatus } from "@/lib/attendance/calculations";
import type { AttendanceRecord, Shift, Status } from "@/lib/types";

export interface DayRow {
  date: string;
  status: Status | null; // null = hari yang belum terjadi
  check_in_at: string | null;
  check_out_at: string | null;
  net_work_minutes: number;
  overtime_minutes: number;
  shift: Shift | null;
}

export interface MonthSummary {
  workDays: number;
  presentDays: number;
  absentDays: number;
  permissionDays: number;
  sickDays: number;
  holidayDays: number;
  totalNetMinutes: number;
  totalOvertimeMinutes: number;
  /** Jumlah hari hadir per kategori shift. */
  shiftDays: Record<Shift, number>;
}

type LeaveType = "SICK" | "PERMISSION" | "ANNUAL_LEAVE" | "OTHER";

/**
 * Menyusun rekap satu PERIODE pembukuan (tgl 21 bulan sebelumnya s/d tgl 20
 * bulan `month`; lihat lib/attendance/period.ts) dari kalender: hari kerja tanpa aktivitas yang
 * sudah lewat dihitung ABSENT (tidak ada baris DB untuk hari absen, jadi
 * tidak bisa dihitung hanya dari tabel attendance_records).
 */
export function buildMonth(params: {
  year: number;
  month: number;
  records: (Pick<AttendanceRecord, "work_date" | "status" | "check_in_at" | "check_out_at" | "net_work_minutes" | "overtime_minutes"> & { shift?: Shift | null })[];
  holidays: string[];
  approvedLeaves: { leave_date: string; leave_type: LeaveType }[];
  today?: string;
}): { days: DayRow[]; summary: MonthSummary } {
  const { year, month } = params;
  const today = params.today ?? getWorkDateInTimezone();
  const recByDate = new Map(params.records.map((r) => [r.work_date, r]));
  const holidaySet = new Set(params.holidays);
  const leaveByDate = new Map(params.approvedLeaves.map((l) => [l.leave_date, l.leave_type]));

  const days: DayRow[] = [];
  const summary: MonthSummary = {
    workDays: 0, presentDays: 0, absentDays: 0, permissionDays: 0,
    sickDays: 0, holidayDays: 0, totalNetMinutes: 0, totalOvertimeMinutes: 0,
    shiftDays: { PAGI: 0, SORE: 0, MALAM: 0 },
  };

  const period = getPeriod(year, month);
  for (const date of listDates(period.start, period.end)) {
    const rec = recByDate.get(date);
    const wd = weekdayOfDateString(date);

    let status: Status | null;
    if (rec && rec.check_in_at) {
      status = "PRESENT";
    } else if (date > today) {
      status = null;
    } else {
      status = resolveAttendanceStatus({
        isHoliday: holidaySet.has(date),
        isConfiguredDayOff: wd === 0 || wd === 6,
        approvedLeaveType: leaveByDate.get(date) ?? null,
        hasCheckIn: false,
      });
    }

    days.push({
      date,
      status,
      check_in_at: rec?.check_in_at ?? null,
      check_out_at: rec?.check_out_at ?? null,
      net_work_minutes: rec?.net_work_minutes ?? 0,
      overtime_minutes: rec?.overtime_minutes ?? 0,
      shift: rec?.shift ?? null,
    });

    if (status === null) continue;
    if (status !== "HOLIDAY" && status !== "DAY_OFF") summary.workDays++;
    if (status === "PRESENT") {
      summary.presentDays++;
      if (rec?.shift) summary.shiftDays[rec.shift]++;
    }
    if (status === "ABSENT") summary.absentDays++;
    if (status === "PERMISSION") summary.permissionDays++;
    if (status === "SICK") summary.sickDays++;
    if (status === "HOLIDAY") summary.holidayDays++;
    summary.totalNetMinutes += rec?.net_work_minutes ?? 0;
    summary.totalOvertimeMinutes += rec?.overtime_minutes ?? 0;
  }
  return { days, summary };
}
