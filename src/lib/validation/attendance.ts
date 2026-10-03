import { z } from "zod";
import { SHIFTS } from "@/lib/types";

/**
 * user_id dan work_date TIDAK PERNAH diterima dari client untuk
 * check-in/out: server menentukannya dari sesi dan jam server.
 */
const method = z.enum(["SELFIE", "BIOMETRIC", "MANUAL"]);
const geo = {
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
};

const baseCaptureSchema = z.object({
  method,
  photoPath: z.string().min(1).max(500).optional(),
  ...geo,
});

/** Absen masuk WAJIB menyertakan kategori shift (pagi / sore / malam). */
export const checkInSchema = baseCaptureSchema.extend({
  shift: z.enum(SHIFTS, { errorMap: () => ({ message: "Pilih shift: pagi, sore, atau malam." }) }),
});
export type CheckInInput = z.infer<typeof checkInSchema>;

export const checkOutSchema = baseCaptureSchema;
export type CheckOutInput = z.infer<typeof checkOutSchema>;

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD");
const timeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Format jam harus HH:mm");

export const leaveRequestSchema = z.object({
  leaveDate: dateStr,
  leaveType: z.enum(["PERMISSION", "SICK", "ANNUAL_LEAVE", "OTHER"]),
  reason: z.string().trim().min(3, "Alasan minimal 3 karakter").max(1000),
});
export type LeaveRequestInput = z.infer<typeof leaveRequestSchema>;

export const leaveDecisionSchema = z.object({
  id: z.string().uuid(),
  decision: z.enum(["APPROVED", "REJECTED"]),
});

/** Koreksi/pembuatan absensi oleh admin. Jam dalam waktu lokal APP_TIMEZONE. */
export const adminCorrectionSchema = z.object({
  userId: z.string().uuid(),
  workDate: dateStr,
  checkInTime: timeStr.nullable().optional(),
  checkOutTime: timeStr.nullable().optional(),
  breakMinutes: z.number().int().min(0).max(600).optional(),
  notes: z.string().max(1000).optional(),
  shift: z.enum(SHIFTS).nullable().optional(),
});
export type AdminCorrectionInput = z.infer<typeof adminCorrectionSchema>;

export const createEmployeeSchema = z.object({
  email: z.string().trim().email("Email tidak valid"),
  password: z.string().min(8, "Password minimal 8 karakter").max(72),
  fullName: z.string().trim().min(2, "Nama minimal 2 karakter").max(120),
  employeeCode: z.string().trim().max(30).optional(),
  position: z.string().trim().max(80).optional(),
  department: z.string().trim().max(80).optional(),
  role: z.enum(["employee", "admin"]).default("employee"),
});

export const updateEmployeeSchema = z.object({
  id: z.string().uuid(),
  isActive: z.boolean(),
});

/** Format error konsisten — tidak pernah membocorkan stack trace. */
export function apiError(code: string, message: string, status = 400) {
  return Response.json({ success: false, error: { code, message } }, { status });
}

export function apiSuccess<T>(data: T, status = 200) {
  return Response.json({ success: true, data }, { status });
}
