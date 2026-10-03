import { generateRegistrationOptions, verifyRegistrationResponse } from "@simplewebauthn/server";
import { generateAuthenticationOptions, verifyAuthenticationResponse } from "@simplewebauthn/server";
import { getServiceRoleClient } from "@/lib/supabase/server";

const RP_NAME = "Absensi App";
const RP_ID = process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID ?? "localhost"; // ganti di production
const ORIGIN = process.env.NEXT_PUBLIC_WEBAUTHN_ORIGIN ?? "http://localhost:3000";

export interface WebAuthnRegistrationResult {
  credentialId: string;
  publicKey: string;
  counter: number;
  deviceName: string | null;
}

export interface WebAuthnAuthResult {
  credentialId: string;
  counter: number;
}

/**
 * Generate registration options untuk WebAuthn (passkey/biometrik).
 * Dipanggil saat user daftarkan perangkat baru.
 */
export async function generateWebAuthnRegistrationOptions(
  userId: string,
  userName: string
): Promise<{ options: any; challenge: string }> {
  const supabase = getServiceRoleClient();
  
  // Ambil credential existing untuk excludeCredentials
  const { data: existing } = await supabase
    .from("biometric_credentials")
    .select("credential_id")
    .eq("user_id", userId);

  const excludeCredentials = (existing ?? []).map((c) => ({
    id: c.credential_id, // Already base64url string from DB
    type: "public-key" as const,
    transports: ["internal", "hybrid", "usb", "ble", "nfc"] as string[],
  }));

  // Convert userId (UUID string) to Uint8Array for WebAuthn
  const userIdBuffer = new TextEncoder().encode(userId);

  const options = generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: userIdBuffer,
    userName,
    userDisplayName: userName,
    attestationType: "none",
    authenticatorSelection: {
      authenticatorAttachment: "platform", // prefer platform authenticator (FaceID, TouchID, Windows Hello)
      residentKey: "preferred",
      requireResidentKey: false,
      userVerification: "required",
    },
    supportedAlgorithmIDs: [-7, -257], // ES256, RS256
    excludeCredentials,
  });

  const result = await options;
  return { options: result, challenge: result.challenge };
}

/**
 * Verify registration response dari client.
 * Simpan credential ke DB jika valid.
 */
export async function verifyWebAuthnRegistration(
  userId: string,
  response: any,
  challenge: string,
  deviceName?: string
): Promise<{ result: WebAuthnRegistrationResult | null; error: string | null }> {
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true,
    });
  } catch (e) {
    return { result: null, error: e instanceof Error ? e.message : "Verifikasi registrasi gagal." };
  }

  if (!verification.verified || !verification.registrationInfo) {
    return { result: null, error: "Verifikasi gagal: respons tidak valid." };
  }

  const { credential } = verification.registrationInfo;
  const credentialID = credential.id;
  const credentialPublicKey = credential.publicKey;
  const counter = 0; // Initial counter for new credential

  // Simpan ke DB
  const supabase = getServiceRoleClient();
  const { error } = await supabase.from("biometric_credentials").insert({
    user_id: userId,
    credential_id: Buffer.from(credentialID).toString("base64"),
    public_key: Buffer.from(credentialPublicKey).toString("base64"),
    counter,
    device_name: deviceName ?? null,
  });

  if (error) {
    console.error("Save credential error:", error);
    return { result: null, error: "Gagal menyimpan kredensial." };
  }

  return {
    result: {
      credentialId: Buffer.from(credentialID).toString("base64"),
      publicKey: Buffer.from(credentialPublicKey).toString("base64"),
      counter,
      deviceName: deviceName ?? null,
    },
    error: null,
  };
}

/**
 * Generate authentication options untuk login/verifikasi.
 */
export async function generateWebAuthnAuthenticationOptions(
  userId: string
): Promise<{ options: any; challenge: string } | { error: string }> {
  const supabase = getServiceRoleClient();
  const { data: credentials } = await supabase
    .from("biometric_credentials")
    .select("credential_id")
    .eq("user_id", userId);

  if (!credentials || credentials.length === 0) {
    return { error: "Belum ada perangkat terdaftar." };
  }

  const allowCredentials = credentials.map((c) => ({
    id: c.credential_id, // Already base64url string from DB
    type: "public-key" as const,
    transports: ["internal", "hybrid", "usb", "ble", "nfc"] as string[],
  }));

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials,
    userVerification: "required",
  });

  return { options, challenge: options.challenge };
}

/**
 * Verify authentication response.
 * Update counter di DB jika valid.
 */
export async function verifyWebAuthnAuthentication(
  userId: string,
  response: any,
  challenge: string
): Promise<{ result: WebAuthnAuthResult | null; error: string | null }> {
  const supabase = getServiceRoleClient();
  
  // Ambil credential dari DB
  const { data: credential } = await supabase
    .from("biometric_credentials")
    .select("credential_id, public_key, counter")
    .eq("user_id", userId)
    .eq("credential_id", Buffer.from(response.rawId).toString("base64"))
    .maybeSingle();

  if (!credential) {
    return { result: null, error: "Kredensial tidak ditemukan." };
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: credential.credential_id, // base64url string
        publicKey: Buffer.from(credential.public_key, "base64"),
        counter: credential.counter,
      },
      requireUserVerification: true,
    });
  } catch (e) {
    return { result: null, error: e instanceof Error ? e.message : "Verifikasi autentikasi gagal." };
  }

  if (!verification.verified) {
    return { result: null, error: "Verifikasi gagal: respons tidak valid." };
  }

  // Update counter
  await supabase
    .from("biometric_credentials")
    .update({ counter: verification.authenticationInfo.newCounter, last_used_at: new Date().toISOString() })
    .eq("credential_id", credential.credential_id);

  return {
    result: {
      credentialId: credential.credential_id,
      counter: verification.authenticationInfo.newCounter,
    },
    error: null,
  };
}

/**
 * Hapus credential (user hapus perangkat).
 */
export async function deleteWebAuthnCredential(
  userId: string,
  credentialId: string
): Promise<{ error: string | null }> {
  const supabase = getServiceRoleClient();
  const { error } = await supabase
    .from("biometric_credentials")
    .delete()
    .eq("user_id", userId)
    .eq("credential_id", credentialId);
  if (error) return { error: "Gagal menghapus kredensial." };
  return { error: null };
}

/**
 * List credential user.
 */
export async function listWebAuthnCredentials(userId: string) {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from("biometric_credentials")
    .select("credential_id, device_name, counter, created_at, last_used_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return data ?? [];
}