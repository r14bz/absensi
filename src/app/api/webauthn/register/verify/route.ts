import { getAuthenticatedProfile } from "@/lib/supabase/server";
import { verifyWebAuthnRegistration } from "@/lib/webauthn/server";
import { apiError, apiSuccess } from "@/lib/validation/attendance";

export const dynamic = "force-dynamic";

/**
 * POST /api/webauthn/register/verify
 * Body: { response: RegistrationResponseJSON, challenge: string, deviceName?: string }
 * Return: { credentialId }
 */
export async function POST(request: Request) {
  const profile = await getAuthenticatedProfile();
  if (!profile) return apiError("UNAUTHENTICATED", "Anda harus login.", 401);

  let body: { response: any; challenge: string; deviceName?: string } = { response: null, challenge: "" };
  try {
    body = await request.json();
  } catch {
    return apiError("INVALID_JSON", "Body request tidak valid.", 400);
  }

  const { result, error } = await verifyWebAuthnRegistration(
    profile.id,
    body.response,
    body.challenge,
    body.deviceName
  );

  if (error || !result) {
    return apiError("VERIFICATION_FAILED", error ?? "Verifikasi registrasi gagal.", 400);
  }

  return apiSuccess({ credentialId: result.credentialId });
}