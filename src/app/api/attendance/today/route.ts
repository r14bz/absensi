import { getAuthenticatedProfile, getServiceRoleClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/validation/attendance";
import { findActiveRecord } from "@/lib/server/active-record";

export const dynamic = "force-dynamic";

export async function GET() {
  const profile = await getAuthenticatedProfile();
  if (!profile) return apiError("UNAUTHENTICATED", "Anda harus login.", 401);

  const { record, today, error } = await findActiveRecord(getServiceRoleClient(), profile.id);
  if (error) return apiError("DB_ERROR", "Gagal mengambil data absensi hari ini.", 500);

  return apiSuccess({ workDate: today, attendance: record });
}
