import { getAuthenticatedProfile } from "@/lib/supabase/server";
import { listWebAuthnCredentials, deleteWebAuthnCredential } from "@/lib/webauthn/server";
import { apiError, apiSuccess } from "@/lib/validation/attendance";

export const dynamic = "force-dynamic";

/**
 * GET /api/webauthn/credentials
 * Return: { credentials: [{ credential_id, device_name, counter, created_at, last_used_at }] }
 */
export async function GET() {
  const profile = await getAuthenticatedProfile();
  if (!profile) return apiError("UNAUTHENTICATED", "Anda harus login.", 401);

  const credentials = await listWebAuthnCredentials(profile.id);
  return apiSuccess({ credentials });
}

/**
 * DELETE /api/webauthn/credentials
 * Body: { credentialId: string }
 * Return: { success: true }
 */
export async function DELETE(request: Request) {
  const profile = await getAuthenticatedProfile();
  if (!profile) return apiError("UNAUTHENTICATED", "Anda harus login.", 401);

  let body: { credentialId: string } = { credentialId: "" };
  try {
    body = await request.json();
  } catch {
    return apiError("INVALID_JSON", "Body request tidak valid.", 400);
  }

  if (!body.credentialId) {
    return apiError("VALIDATION_ERROR", "credentialId wajib diisi.", 422);
  }

  const { error } = await deleteWebAuthnCredential(profile.id, body.credentialId);
  if (error) return apiError("DELETE_FAILED", error, 400);

  return apiSuccess({ success: true });
}