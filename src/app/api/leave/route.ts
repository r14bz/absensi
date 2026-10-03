import { getAuthenticatedProfile, getServerClient } from "@/lib/supabase/server";
import { leaveRequestSchema, apiError, apiSuccess } from "@/lib/validation/attendance";
import { getWorkDateInTimezone } from "@/lib/timezone";

export const dynamic = "force-dynamic";

export async function GET() {
  const profile = await getAuthenticatedProfile();
  if (!profile) return apiError("UNAUTHENTICATED", "Anda harus login.", 401);

  const { data, error } = await getServerClient()
    .from("leave_requests")
    .select("id, leave_date, leave_type, reason, status, created_at")
    .eq("user_id", profile.id)
    .order("leave_date", { ascending: false })
    .limit(50);
  if (error) return apiError("DB_ERROR", "Gagal memuat pengajuan.", 500);
  return apiSuccess({ requests: data ?? [] });
}

export async function POST(request: Request) {
  const profile = await getAuthenticatedProfile();
  if (!profile) return apiError("UNAUTHENTICATED", "Anda harus login.", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("INVALID_JSON", "Body request tidak valid.", 400);
  }
  const parsed = leaveRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.issues.map((i) => i.message).join("; "), 422);
  }
  const input = parsed.data;

  // Boleh untuk hari ini s/d ke depan; tidak boleh mundur ke tanggal yang sudah lewat.
  if (input.leaveDate < getWorkDateInTimezone()) {
    return apiError("VALIDATION_ERROR", "Tanggal pengajuan tidak boleh sebelum hari ini.", 422);
  }

  const supabase = getServerClient();
  const { data: dup } = await supabase
    .from("leave_requests")
    .select("id")
    .eq("user_id", profile.id)
    .eq("leave_date", input.leaveDate)
    .in("status", ["PENDING", "APPROVED"])
    .limit(1);
  if (dup && dup.length > 0) {
    return apiError("DUPLICATE", "Sudah ada pengajuan aktif untuk tanggal tersebut.", 409);
  }

  const { data, error } = await supabase
    .from("leave_requests")
    .insert({
      user_id: profile.id,
      leave_date: input.leaveDate,
      leave_type: input.leaveType,
      reason: input.reason,
      status: "PENDING",
    })
    .select("id, leave_date, leave_type, reason, status, created_at")
    .single();
  if (error) return apiError("DB_ERROR", "Gagal mengirim pengajuan.", 500);
  return apiSuccess({ request: data }, 201);
}
