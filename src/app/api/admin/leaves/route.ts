import { getAdminProfile, getServiceRoleClient } from "@/lib/supabase/server";
import { leaveDecisionSchema, apiError, apiSuccess } from "@/lib/validation/attendance";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getAdminProfile();
  if (!admin) return apiError("FORBIDDEN", "Akses khusus admin.", 403);

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from("leave_requests")
    .select("id, user_id, leave_date, leave_type, reason, status, created_at, profiles!leave_requests_user_id_fkey(full_name)")
    .order("status", { ascending: false })
    .order("leave_date", { ascending: false })
    .limit(100);
  if (error) return apiError("DB_ERROR", "Gagal memuat pengajuan.", 500);

  const requests = (data ?? []).map((r) => {
    const p = r.profiles as unknown as { full_name: string } | { full_name: string }[] | null;
    const name = Array.isArray(p) ? p[0]?.full_name : p?.full_name;
    return { ...r, profiles: undefined, full_name: name ?? "—" };
  });
  return apiSuccess({ requests });
}

/** Setujui / tolak. Saat disetujui, hari tersebut dicatat sebagai SICK/PERMISSION di absensi. */
export async function PATCH(request: Request) {
  const admin = await getAdminProfile();
  if (!admin) return apiError("FORBIDDEN", "Akses khusus admin.", 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("INVALID_JSON", "Body request tidak valid.", 400);
  }
  const parsed = leaveDecisionSchema.safeParse(body);
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Data tidak valid.", 422);

  const supabase = getServiceRoleClient();
  const { data: leave } = await supabase.from("leave_requests").select("*").eq("id", parsed.data.id).maybeSingle();
  if (!leave) return apiError("NOT_FOUND", "Pengajuan tidak ditemukan.", 404);
  if (leave.status !== "PENDING") return apiError("ALREADY_DECIDED", "Pengajuan sudah diputuskan.", 409);

  if (parsed.data.decision === "APPROVED") {
    const { data: rec } = await supabase
      .from("attendance_records")
      .select("id, check_in_at")
      .eq("user_id", leave.user_id)
      .eq("work_date", leave.leave_date)
      .maybeSingle();
    if (rec?.check_in_at) {
      return apiError("HAS_ATTENDANCE", "Karyawan sudah absen pada tanggal tersebut; koreksi absensinya dulu.", 409);
    }
    if (!rec) {
      const { error: insErr } = await supabase.from("attendance_records").insert({
        user_id: leave.user_id,
        work_date: leave.leave_date,
        status: leave.leave_type === "SICK" ? "SICK" : "PERMISSION",
        notes: leave.reason,
      });
      if (insErr) return apiError("DB_ERROR", "Gagal mencatat izin ke absensi.", 500);
    } else {
      await supabase.from("attendance_records")
        .update({ status: leave.leave_type === "SICK" ? "SICK" : "PERMISSION", notes: leave.reason })
        .eq("id", rec.id);
    }
  }

  const { error } = await supabase
    .from("leave_requests")
    .update({ status: parsed.data.decision, approved_by: admin.id, approved_at: new Date().toISOString() })
    .eq("id", leave.id)
    .eq("status", "PENDING");
  if (error) return apiError("DB_ERROR", "Gagal menyimpan keputusan.", 500);

  await supabase.from("audit_logs").insert({
    actor_user_id: admin.id,
    action: `LEAVE_${parsed.data.decision}`,
    entity_type: "leave_requests",
    entity_id: leave.id,
    old_data: { status: leave.status },
    new_data: { status: parsed.data.decision },
  });
  return apiSuccess({ ok: true });
}
