import { getAuthenticatedProfile, getServiceRoleClient } from "@/lib/supabase/server";
import { checkOutSchema, apiError, apiSuccess } from "@/lib/validation/attendance";
import { calculateAttendance } from "@/lib/attendance/calculations";
import { findActiveRecord } from "@/lib/server/active-record";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const profile = await getAuthenticatedProfile();
  if (!profile) return apiError("UNAUTHENTICATED", "Anda harus login.", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("INVALID_JSON", "Body request tidak valid.", 400);
  }

  const parsed = checkOutSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.issues.map((i) => i.message).join("; "), 422);
  }
  const input = parsed.data;

  const now = new Date();
  const supabase = getServiceRoleClient();

  // Shift malam: absen pulang terjadi setelah tengah malam, barisnya bertanggal kemarin.
  const active = await findActiveRecord(supabase, profile.id, "*", now);
  if (active.error) return apiError("DB_ERROR", "Gagal memeriksa data absensi.", 500);
  const existing = active.record as { id: string; check_in_at: string | null; check_out_at: string | null; break_minutes: number } | null;

  if (!existing || !existing.check_in_at) {
    return apiError("ATTENDANCE_NOT_CHECKED_IN", "Anda belum melakukan absen masuk hari ini.", 409);
  }
  if (existing.check_out_at) {
    return apiError("ATTENDANCE_ALREADY_CHECKED_OUT", "Anda sudah melakukan absen pulang hari ini.", 409);
  }

  const { data: settingsRow } = await supabase
    .from("work_settings")
    .select("standard_work_minutes, overtime_rounding_minutes")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let calc;
  try {
    calc = calculateAttendance({
      checkInAt: new Date(existing.check_in_at),
      checkOutAt: now,
      settings: {
        breakMinutes: existing.break_minutes ?? 60,
        standardWorkMinutes: settingsRow?.standard_work_minutes ?? 480,
        overtimeRoundingMinutes: settingsRow?.overtime_rounding_minutes ?? 60,
      },
    });
  } catch {
    return apiError("INVALID_TIME_RANGE", "Waktu pulang tidak valid (lebih awal dari waktu masuk).", 422);
  }

  // Filter `check_out_at is null` mencegah dua check-out bersamaan saling menimpa.
  const { data: record, error: updateError } = await supabase
    .from("attendance_records")
    .update({
      check_out_at: now.toISOString(),
      check_out_method: input.method,
      check_out_photo_path: input.photoPath ?? null,
      check_out_latitude: input.latitude ?? null,
      check_out_longitude: input.longitude ?? null,
      gross_work_minutes: calc.grossWorkMinutes,
      net_work_minutes: calc.netWorkMinutes,
      overtime_minutes: calc.overtimeMinutes,
    })
    .eq("id", existing.id)
    .is("check_out_at", null)
    .select()
    .maybeSingle();

  if (updateError) return apiError("DB_ERROR", "Gagal menyimpan absen pulang.", 500);
  if (!record) {
    return apiError("ATTENDANCE_ALREADY_CHECKED_OUT", "Anda sudah melakukan absen pulang hari ini.", 409);
  }

  await supabase.from("attendance_events").insert({
    attendance_id: record.id,
    user_id: profile.id,
    event_type: "CHECK_OUT",
    event_at: now.toISOString(),
    method: input.method,
    photo_path: input.photoPath ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
  });

  return apiSuccess({ attendance: record, calculation: calc });
}
