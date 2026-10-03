"use client";

import { useCallback, useEffect, useState } from "react";
import { checkWebAuthnSupport, registerWebAuthn, authenticateWebAuthn } from "@/lib/webauthn/client";
import { api } from "@/lib/client/api";

interface BiometricAuthProps {
  mode: "register" | "authenticate";
  onSuccess: (credentialId: string) => void;
  onCancel: () => void;
  onError?: (error: string) => void;
}

export function BiometricAuth({ mode, onSuccess, onCancel, onError }: BiometricAuthProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [support, setSupport] = useState<{ isSupported: boolean; isConditionalMediationAvailable: boolean }>({
    isSupported: false,
    isConditionalMediationAvailable: false,
  });

  useEffect(() => {
    setSupport(checkWebAuthnSupport());
  }, []);

  const handleAction = useCallback(async () => {
    if (!support.isSupported) {
      const msg = "Browser/perangkat tidak mendukung WebAuthn (Passkey/FaceID/TouchID/Windows Hello).";
      setError(msg);
      onError?.(msg);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (mode === "register") {
        // 1. Get registration options from server
        const startRes = await api<{ options: any; challenge: string }>("/api/webauthn/register/start", {
          method: "POST",
          body: JSON.stringify({ deviceName: navigator.userAgent }),
        });
        if (!startRes.success || !startRes.data) throw new Error(startRes.error?.message ?? "Gagal memulai registrasi");

        // 2. Perform registration on client
        const response = await registerWebAuthn(startRes.data.options);

        // 3. Verify on server
        const verifyRes = await api<{ credentialId: string }>("/api/webauthn/register/verify", {
          method: "POST",
          body: JSON.stringify({
            response,
            challenge: startRes.data.challenge,
            deviceName: navigator.userAgent,
          }),
        });
        if (!verifyRes.success || !verifyRes.data) throw new Error(verifyRes.error?.message ?? "Verifikasi gagal");

        onSuccess(verifyRes.data.credentialId);
      } else {
        // 1. Get authentication options from server
        const startRes = await api<{ options: any; challenge: string }>("/api/webauthn/authenticate/start", {
          method: "POST",
        });
        if (!startRes.success || !startRes.data) throw new Error(startRes.error?.message ?? "Gagal memulai autentikasi");

        // 2. Perform authentication on client
        const response = await authenticateWebAuthn(startRes.data.options);

        // 3. Verify on server
        const verifyRes = await api<{ success: boolean }>("/api/webauthn/authenticate/verify", {
          method: "POST",
          body: JSON.stringify({
            response,
            challenge: startRes.data.challenge,
          }),
        });
        if (!verifyRes.success) throw new Error(verifyRes.error?.message ?? "Verifikasi gagal");

        onSuccess("verified");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Operasi biometrik gagal.";
      setError(msg);
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  }, [mode, onSuccess, onError, support.isSupported]);

  if (!support.isSupported) {
    return (
      <div className="card p-4 space-y-4">
        <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-sm">
            Perangkat/browser ini <strong>tidak mendukung</strong> autentikasi biometrik (WebAuthn).
            Gunakan metode Selfie atau Manual.
          </p>
        </div>
        <button type="button" onClick={onCancel} className="btn-ghost w-full">
          Kembali
        </button>
      </div>
    );
  }

  return (
    <div className="card p-4 space-y-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="w-20 h-20 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
          <svg className="w-10 h-10 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-semibold">
            {mode === "register" ? "Daftarkan Perangkat" : "Verifikasi Identitas"}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {mode === "register"
              ? "Gunakan Face ID / Touch ID / Windows Hello / PIN untuk mendaftarkan perangkat ini."
              : "Gunakan Face ID / Touch ID / Windows Hello / PIN untuk memverifikasi identitas Anda."}
          </p>
        </div>
      </div>

      {error && <div role="alert" className="alert-error">{error}</div>}

      <button
        type="button"
        onClick={handleAction}
        disabled={loading}
        className="btn-primary w-full !min-h-[52px] text-base"
      >
        {loading
          ? "Memproses..."
          : mode === "register"
          ? "Daftarkan Perangkat Ini"
          : "Verifikasi Sekarang"}
      </button>

      <button type="button" onClick={onCancel} className="btn-ghost w-full">
        Batal
      </button>
    </div>
  );
}