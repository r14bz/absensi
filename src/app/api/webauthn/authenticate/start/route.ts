import { getAuthenticatedProfile } from "@/lib/supabase/server";
import { generateWebAuthnAuthenticationOptions } from "@/lib/webauthn/server";
import { apiError, apiSuccess } from "@/lib/validation/attendance";

export const dynamic = "force-dynamic";

/**
 * POST /api/webauthn/authenticate/start
 * Body: {}
 * Return: { options, challenge }
 */
export async function POST(request: Request) {
  const profile = await getAuthenticatedProfile();
  if (!profile) return apiError("UNAUTHENTICATED", "Anda harus login.", 401);

  const result = await generateWebAuthnAuthenticationOptions(profile.id);
  
  if ("error" in result) {
    return apiError("NO_CREDENTIALS", result.error, 400);
  }

  return apiSuccess({ options: result.options, challenge: result.challenge });
}