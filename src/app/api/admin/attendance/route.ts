import { getAdminProfile, getServiceRoleClient } from "@/lib/supabase/server";
import { adminCorrectionSchema, apiError, apiSuccess } from "@/lib/validation/attendance";
import { getWorkDateInTimezone, weekdayOfDateString, zonedDateTimeToUtc } from "@/lib/timezone";
import { calculateAttendance, resolveAttendanceStatus } from "@/lib/attendance/calculations";

export const dynamic = "force-dynamic";

/** GET /api/admin/attendance?date=YYYY-MM-DD — rekap semua karyawan aktif untuk satu hari. */
export async function GET(request: Request) {
  const admin = await getAdminProfile();
  if (!admin) return apiError("FORBIDDEN", "Akses khusus admin.", 403);

  const date = new URL(request.url).searchParams.get("date") ?? getWorkDateInTimezone();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return apiError("VALIDATION_ERROR", "Format tanggal tidak valid.", 422);

  const supabase = getServiceRoleClient();
  const [emps, recs, hol, leaves] = await Promise.all([
    supabase.from("profiles").select("id, full_name, employee_code, position").eq("role", "employee").eq("is_active", true).order("full_name"),
    supabase.from("attendance_records").select("*").eq("work_date", date),
    supabase.from("holidays").select("name").eq("holiday_date", date).maybeSingle(),
    supabase.from("leave_requests").select("user_id, leave_type").eq("leave_date", date).eq("status", "APPROVED"),
  ]);
  if (emps.error || recs.error || hol.error || leaves.error) return apiError("DB_ERROR", "Gagal memuat rekap.", 500);

  const wd = weekdayOfDateString(date);
  const today = getWorkDateInTimezone();
  const recBy = new Map((recs.data ?? []).map((r) => [r.user_id as string, r]));
  const leaveBy = new Map((leaves.data ?? []).map((l) => [l.user_id as string, l.leave_type as "SICK" | "PERMISSION" | "ANNUAL_LEAVE" | "OTHER"]));

  const rows = (emps.data ?? []).map((e) => {
    const r = recBy.get(e.id);
    const status = r?.check_in_at
      ? "PRESENT"
      : date > today
      ? null
      : resolveAttendanceStatus({
          isHoliday: Boolean(hol.data),
          isConfiguredDayOff: wd === 0 || wd === 6,
          approvedLeaveType: leaveBy.get(e.id) ?? null,
          hasCheckIn: false,
        });
    return {
      user_id: e.id,
      full_name: e.full_name,
      employee_code: e.employee_code,
      position: e.position,
      status,
      check_in_at: r?.check_in_at ?? null,
      check_out_at: r?.check_out_at ?? null,
      net_work_minutes: r?.net_work_minutes ?? 0,
      overtime_minutes: r?.overtime_minutes ?? 0,
      break_minutes: r?.break_minutes ?? 60,
      notes: r?.notes ?? null,
      shift: r?.shift ?? null,
    };
  });

  return apiSuccess({ date, holiday: hol.data?.name ?? null, rows });
}

/** POST — buat/koreksi absensi seorang karyawan pada tanggal tertentu (dicatat ke audit log). */
export async function POST(request: Request) {
  const admin = await getAdminProfile();
  if (!admin) return apiError("FORBIDDEN", "Akses khusus admin.", 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("INVALID_JSON", "Body request tidak valid.", 400);
  }
  const parsed = adminCorrectionSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.issues.map((i) => i.message).join("; "), 422);
  }
  const input = parsed.data;

  const supabase = getServiceRoleClient();
  const { data: target } = await supabase.from("profiles").select("id").eq("id", input.userId).maybeSingle();
  if (!target) return apiError("NOT_FOUND", "Karyawan tidak ditemukan.", 404);

  const { data: old } = await supabase
    .from("attendance_records")
    .select("*")
    .eq("user_id", input.userId)
    .eq("work_date", input.workDate)
    .maybeSingle();

  const checkIn = input.checkInTime === undefined
    ? old?.check_in_at ?? null
    : input.checkInTime === null ? null : zonedDateTimeToUtc(input.workDate, input.checkInTime).toISOString();
  const checkOut = input.checkOutTime === undefined
    ? old?.check_out_at ?? null
    : input.checkOutTime === null ? null : zonedDateTimeToUtc(input.workDate, input.checkOutTime).toISOString();

  if (checkOut && !checkIn) return apiError("VALIDATION_ERROR", "Jam pulang membutuhkan jam masuk.", 422);

  const breakMinutes = input.breakMinutes ?? old?.break_minutes ?? 60;
  let gross = 0, net = 0, overtime = 0;
  if (checkIn && checkOut) {
    const { data: s } = await supabase
      .from("work_settings")
      .select("standard_work_minutes, overtime_rounding_minutes")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    try {
      const calc = calculateAttendance({
        checkInAt: new Date(checkIn),
        checkOutAt: new Date(checkOut),
        settings: {
          breakMinutes,
          standardWorkMinutes: s?.standard_work_minutes ?? 480,
          overtimeRoundingMinutes: s?.overtime_rounding_minutes ?? 60,
        },
      });
      gross = calc.grossWorkMinutes; net = calc.netWorkMinutes; overtime = calc.overtimeMinutes;
    } catch {
      return apiError("INVALID_TIME_RANGE", "Jam pulang harus setelah jam masuk.", 422);
    }
  }

  const payload = {
    user_id: input.userId,
    work_date: input.workDate,
    check_in_at: checkIn,
    check_out_at: checkOut,
    break_minutes: breakMinutes,
    gross_work_minutes: gross,
    net_work_minutes: net,
    overtime_minutes: overtime,
    status: checkIn ? "PRESENT" : old?.status ?? "ABSENT",
    notes: input.notes ?? old?.notes ?? null,
    shift: input.shift === undefined ? old?.shift ?? null : input.shift,
    check_in_method: checkIn ? old?.check_in_method ?? "MANUAL" : null,
    check_out_method: checkOut ? old?.check_out_method ?? "MANUAL" : null,
  };

  const { data: saved, error } = await supabase
    .from("attendance_records")
    .upsert(payload, { onConflict: "user_id,work_date" })
    .select()
    .single();
  if (error) return apiError("DB_ERROR", "Gagal menyimpan koreksi.", 500);

  await Promise.all([
    supabase.from("attendance_events").insert({
      attendance_id: saved.id,
      user_id: input.userId,
      event_type: "MANUAL_CORRECTION",
      method: "MANUAL",
      metadata: { by: admin.id },
    }),
    supabase.from("audit_logs").insert({
      actor_user_id: admin.id,
      action: old ? "ATTENDANCE_CORRECTED" : "ATTENDANCE_CREATED",
      entity_type: "attendance_records",
      entity_id: saved.id,
      old_data: old ?? null,
      new_data: saved,
      user_agent: request.headers.get("user-agent"),
    }),
  ]);

  return apiSuccess({ attendance: saved });
}
