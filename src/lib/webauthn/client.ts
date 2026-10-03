"use client";

import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import type { 
  RegistrationResponseJSON, 
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON
} from "@simplewebauthn/types";

export interface WebAuthnSupport {
  isSupported: boolean;
  isConditionalMediationAvailable: boolean;
}

/**
 * Cek dukungan WebAuthn di browser.
 */
export function checkWebAuthnSupport(): WebAuthnSupport {
  if (typeof window === "undefined") {
    return { isSupported: false, isConditionalMediationAvailable: false };
  }
  const isSupported = "credentials" in navigator && "create" in navigator.credentials;
  let isConditionalMediationAvailable = false;
  if (isSupported && "isConditionalMediationAvailable" in navigator.credentials) {
    // @ts-ignore - API baru
    navigator.credentials.isConditionalMediationAvailable?.().then((avail: boolean) => {
      isConditionalMediationAvailable = avail;
    });
  }
  return { isSupported, isConditionalMediationAvailable };
}

/**
 * Register WebAuthn credential (passkey/biometrik).
 * Return response untuk dikirim ke server verify.
 */
export async function registerWebAuthn(
  options: PublicKeyCredentialCreationOptionsJSON
): Promise<RegistrationResponseJSON | null> {
  try {
    const response = await startRegistration({ optionsJSON: options });
    return response as RegistrationResponseJSON;
  } catch (e) {
    if (e instanceof Error && e.name === "NotAllowedError") {
      throw new Error("Registrasi dibatalkan atau ditolak.");
    }
    if (e instanceof Error && e.name === "InvalidStateError") {
      throw new Error("Perangkat ini sudah terdaftar atau tidak didukung.");
    }
    throw new Error(e instanceof Error ? e.message : "Registrasi WebAuthn gagal.");
  }
}

/**
 * Authenticate dengan WebAuthn (login/verifikasi).
 */
export async function authenticateWebAuthn(
  options: PublicKeyCredentialRequestOptionsJSON
): Promise<AuthenticationResponseJSON | null> {
  try {
    const response = await startAuthentication({ optionsJSON: options });
    return response as AuthenticationResponseJSON;
  } catch (e) {
    if (e instanceof Error && e.name === "NotAllowedError") {
      throw new Error("Autentikasi dibatalkan atau ditolak.");
    }
    throw new Error(e instanceof Error ? e.message : "Autentikasi WebAuthn gagal.");
  }
}

/**
 * Autofill/conditional UI untuk login (jika didukung).
 */
export async function authenticateWebAuthnConditional(
  options: PublicKeyCredentialRequestOptionsJSON
): Promise<AuthenticationResponseJSON | null> {
  try {
    // Convert JSON options to native WebAuthn options for navigator.credentials.get()
    const nativeOptions: PublicKeyCredentialRequestOptions = {
      ...options,
      challenge: base64urlToBuffer(options.challenge),
      allowCredentials: options.allowCredentials?.map((cred) => ({
        ...cred,
        id: base64urlToBuffer(cred.id),
        transports: cred.transports?.map((t) => (t === "cable" ? "ble" : t)) as AuthenticatorTransport[],
      })),
    };
    
    // @ts-ignore - conditional mediation
    const response = await navigator.credentials.get({
      publicKey: nativeOptions,
      mediation: "conditional",
    });
    return response as AuthenticationResponseJSON;
  } catch (e) {
    if (e instanceof Error && e.name === "NotAllowedError") {
      return null; // user tidak memilih credential
    }
    throw new Error(e instanceof Error ? e.message : "Autentikasi kondisional gagal.");
  }
}

/**
 * Convert base64url string to ArrayBuffer for WebAuthn
 */
function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Format credential ID untuk display.
 */
export function formatCredentialId(base64Id: string): string {
  try {
    const bytes = Uint8Array.from(atob(base64Id), (c) => c.charCodeAt(0));
    return Array.from(bytes.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(":");
  } catch {
    return base64Id.slice(0, 16) + "...";
  }
}