export type Status = "PRESENT" | "ABSENT" | "PERMISSION" | "SICK" | "HOLIDAY" | "DAY_OFF";

export const SHIFTS = ["PAGI", "SORE", "MALAM"] as const;
export type Shift = (typeof SHIFTS)[number];

export const SHIFT_LABEL: Record<Shift, string> = {
  PAGI: "Pagi",
  SORE: "Sore",
  MALAM: "Malam",
};

export interface AttendanceRecord {
  id: string;
  user_id: string;
  work_date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  break_minutes: number;
  gross_work_minutes: number;
  net_work_minutes: number;
  overtime_minutes: number;
  status: Status;
  notes: string | null;
  shift: Shift | null;
}

export interface LeaveRequest {
  id: string;
  user_id: string;
  leave_date: string;
  leave_type: "PERMISSION" | "SICK" | "ANNUAL_LEAVE" | "OTHER";
  reason: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  created_at: string;
}

export const STATUS_LABEL: Record<Status, string> = {
  PRESENT: "Hadir",
  ABSENT: "Tidak hadir",
  PERMISSION: "Izin",
  SICK: "Sakit",
  HOLIDAY: "Libur",
  DAY_OFF: "Libur akhir pekan",
};

export const LEAVE_LABEL: Record<LeaveRequest["leave_type"], string> = {
  PERMISSION: "Izin",
  SICK: "Sakit",
  ANNUAL_LEAVE: "Cuti",
  OTHER: "Lainnya",
};
