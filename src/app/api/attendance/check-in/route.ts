import { getAuthenticatedProfile, getServiceRoleClient } from "@/lib/supabase/server";
import { getWorkDateInTimezone } from "@/lib/timezone";
import { checkInSchema, apiError, apiSuccess } from "@/lib/validation/attendance";
import { findActiveRecord } from "@/lib/server/active-record";
import { isMissingColumn, MIGRATION_HINT } from "@/lib/server/db-errors";

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

  const parsed = checkInSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.issues.map((i) => i.message).join("; "), 422);
  }
  const input = parsed.data;

  // Waktu & tanggal kerja SELALU dari server.
  const now = new Date();
  const workDate = getWorkDateInTimezone(now);
  const supabase = getServiceRoleClient();

  // Query paralel: baris aktif (hari ini / shift malam kemarin) + pengaturan jam kerja.
  const [active, settingsRes] = await Promise.all([
    findActiveRecord(supabase, profile.id, "*", now),
    supabase
      .from("work_settings")
      .select("break_minutes")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (active.error) return apiError("DB_ERROR", "Gagal memeriksa data absensi.", 500);

  const existing = active.record;
  if (active.overnight) {
    return apiError("ATTENDANCE_OVERNIGHT_OPEN", "Shift malam kemarin belum absen pulang. Lakukan absen pulang dulu.", 409);
  }
  if (existing?.check_in_at) {
    return apiError("ATTENDANCE_ALREADY_CHECKED_IN", "Anda sudah melakukan absen masuk hari ini.", 409);
  }
  if (existing && (existing.status === "SICK" || existing.status === "PERMISSION")) {
    return apiError("ON_LEAVE", "Hari ini tercatat izin/sakit yang sudah disetujui.", 409);
  }
  const settings = settingsRes.data;

  const payload = {
    user_id: profile.id,
    work_date: workDate,
    check_in_at: now.toISOString(),
    shift: input.shift,
    check_in_method: input.method,
    check_in_photo_path: input.photoPath ?? null,
    check_in_latitude: input.latitude ?? null,
    check_in_longitude: input.longitude ?? null,
    break_minutes: settings?.break_minutes ?? 60,
    status: "PRESENT" as const,
  };

  const { data: record, error: writeError } = existing
    ? await supabase.from("attendance_records").update(payload).eq("id", existing.id).select().single()
    : await supabase.from("attendance_records").insert(payload).select().single();

  if (writeError) {
    if (isMissingColumn(writeError)) return apiError("MIGRATION_REQUIRED", MIGRATION_HINT, 500);
    // Dua request nyaris bersamaan: unique(user_id, work_date) menolak salah satunya.
    if (writeError.code === "23505") {
      return apiError("ATTENDANCE_ALREADY_CHECKED_IN", "Anda sudah melakukan absen masuk hari ini.", 409);
    }
    return apiError("DB_ERROR", "Gagal menyimpan absensi.", 500);
  }

  await supabase.from("attendance_events").insert({
    attendance_id: record.id,
    user_id: profile.id,
    event_type: "CHECK_IN",
    metadata: { shift: input.shift },
    event_at: now.toISOString(),
    method: input.method,
    photo_path: input.photoPath ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
  });

  return apiSuccess({ attendance: record });
}
