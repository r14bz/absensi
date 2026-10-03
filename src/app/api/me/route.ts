import { getAuthenticatedProfile } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/validation/attendance";

export const dynamic = "force-dynamic";

export async function GET() {
  const profile = await getAuthenticatedProfile();
  if (!profile) return apiError("UNAUTHENTICATED", "Akun tidak aktif atau profil belum dibuat.", 401);
  return apiSuccess({ profile });
}
