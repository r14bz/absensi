import { getAuthenticatedProfile } from "@/lib/supabase/server";
import { verifyWebAuthnAuthentication } from "@/lib/webauthn/server";
import { apiError, apiSuccess } from "@/lib/validation/attendance";

export const dynamic = "force-dynamic";

/**
 * POST /api/webauthn/authenticate/verify
 * Body: { response: AuthenticationResponseJSON, challenge: string }
 * Return: { success: true }
 */
export async function POST(request: Request) {
  const profile = await getAuthenticatedProfile();
  if (!profile) return apiError("UNAUTHENTICATED", "Anda harus login.", 401);

  let body: { response: any; challenge: string } = { response: null, challenge: "" };
  try {
    body = await request.json();
  } catch {
    return apiError("INVALID_JSON", "Body request tidak valid.", 400);
  }

  const { result, error } = await verifyWebAuthnAuthentication(
    profile.id,
    body.response,
    body.challenge
  );

  if (error || !result) {
    return apiError("VERIFICATION_FAILED", error ?? "Verifikasi autentikasi gagal.", 400);
  }

  return apiSuccess({ success: true });
}