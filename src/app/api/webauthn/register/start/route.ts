import { getAuthenticatedProfile } from "@/lib/supabase/server";
import { generateWebAuthnRegistrationOptions, verifyWebAuthnRegistration } from "@/lib/webauthn/server";
import { apiError, apiSuccess } from "@/lib/validation/attendance";

export const dynamic = "force-dynamic";

/**
 * POST /api/webauthn/register/start
 * Body: { deviceName?: string }
 * Return: { options, challenge }
 */
export async function POST(request: Request) {
  const profile = await getAuthenticatedProfile();
  if (!profile) return apiError("UNAUTHENTICATED", "Anda harus login.", 401);

  let body: { deviceName?: string } = {};
  try {
    body = await request.json();
  } catch {
    return apiError("INVALID_JSON", "Body request tidak valid.", 400);
  }

  const { options, challenge } = await generateWebAuthnRegistrationOptions(
    profile.id,
    profile.full_name
  );

  // Simpan challenge ke session/cookie untuk verifikasi nanti
  // Di sini kita kirim challenge di response, client harus kirim balik saat verify
  // (Atau simpan di DB dengan expiry, tapi untuk simple: client hold challenge)

  return apiSuccess({ options, challenge });
}