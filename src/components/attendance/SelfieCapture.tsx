"use client";

import { useCallback, useState } from "react";
import { useAttendanceCapture } from "@/hooks/useAttendanceCapture";
import { uploadSelfieClient } from "@/lib/storage/selfie-client";
import { getBrowserClient } from "@/lib/supabase/client";

interface SelfieCaptureProps {
  onCapture: (data: { photoPath: string; latitude: number; longitude: number }) => void;
  onCancel: () => void;
  method: "SELFIE" | "BIOMETRIC";
  isLoading?: boolean;
}

export default function SelfieCapture({ onCapture, onCancel, method, isLoading }: SelfieCaptureProps) {
  const {
    videoRef,
    canvasRef,
    stream,
    cameraError,
    isCameraSupported,
    isCameraStarting,
    facingMode,
    setFacingMode,
    startCamera,
    capturePhoto,
    position,
    geoError,
    isGeoSupported,
    isGeoLoading,
    getCurrentPosition,
  } = useAttendanceCapture();

  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCapture = useCallback(() => {
    const dataUrl = capturePhoto();
    if (!dataUrl) {
      setError("Gagal menangkap foto. Pastikan kamera sudah menampilkan gambar.");
      return;
    }
    setError(null);
    setPhotoDataUrl(dataUrl);
  }, [capturePhoto]);

  const handleConfirm = useCallback(async () => {
    if (!photoDataUrl || uploading) return;
    if (!position) {
      setError("Lokasi GPS belum didapat. Tekan \"Coba Lagi\" pada status GPS.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const blob = await (await fetch(photoDataUrl)).blob();
      const file = new File([blob], "selfie.jpg", { type: "image/jpeg" });

      const supabase = getBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession(); // lokal (cookie), tanpa round-trip jaringan
      const userId = session?.user?.id;
      if (!userId) throw new Error("Sesi berakhir. Silakan login ulang.");

      const { path, error: uploadError } = await uploadSelfieClient(userId, file);
      if (uploadError || !path) throw new Error(uploadError ?? "Upload gagal: path kosong");

      onCapture({ photoPath: path, latitude: position.latitude, longitude: position.longitude });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengunggah foto.");
    } finally {
      setUploading(false);
    }
  }, [photoDataUrl, position, uploading, onCapture]);

  const gpsBadge = isGeoLoading ? (
    <span className="text-gray-500">Mencari lokasi…</span>
  ) : position ? (
    <span className="text-green-600 dark:text-green-400">GPS OK (±{Math.round(position.accuracy)} m)</span>
  ) : (
    <span className="text-amber-600 dark:text-amber-400">GPS belum</span>
  );

  // ---- Pratinjau foto ----
  if (photoDataUrl) {
    return (
      <div className="card p-4 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold">Pratinjau Selfie</h3>
        <div className="relative aspect-video overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoDataUrl} alt="Hasil selfie" className="h-full w-full object-cover" />
        </div>
        <p className="text-sm">Lokasi: {gpsBadge}</p>
        {error && <div role="alert" className="alert-error">{error}</div>}
        {!position && !isGeoLoading && (
          <button type="button" onClick={() => void getCurrentPosition()} className="btn-ghost w-full">
            Coba Lagi Ambil Lokasi
          </button>
        )}
        <div className="flex gap-2">
          <button type="button" onClick={() => setPhotoDataUrl(null)} className="btn-ghost flex-1" disabled={uploading}>
            Ambil Ulang
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="btn-primary flex-1"
            disabled={uploading || isLoading || !position}
          >
            {uploading || isLoading ? "Mengirim..." : "Gunakan Foto Ini"}
          </button>
        </div>
      </div>
    );
  }

  // ---- Mode kamera ----
  return (
    <div className="card p-4 space-y-4" onClick={(e) => e.stopPropagation()}>
      <h3 className="text-lg font-semibold">{method === "SELFIE" ? "Ambil Selfie" : "Verifikasi Wajah"}</h3>

      {error && <div role="alert" className="alert-error">{error}</div>}

      {!isCameraSupported && !cameraError && (
        <div className="alert-error">Browser tidak mendukung akses kamera.</div>
      )}
      {cameraError && (
        <div role="alert" className="alert-error">
          {cameraError}
          <button type="button" onClick={() => void startCamera()} className="btn-ghost ml-2 text-sm">
            Coba Lagi
          </button>
        </div>
      )}
      {geoError && (
        <div role="alert" className="alert-error">
          {geoError}
          <button type="button" onClick={() => void getCurrentPosition()} className="btn-ghost ml-2 text-sm">
            Coba Lagi
          </button>
        </div>
      )}
      {!isGeoSupported && <div className="alert-error">Browser tidak mendukung geolocation.</div>}

      <div className="relative aspect-video overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800">
        {/* Elemen <video> SELALU dirender agar ref siap saat stream datang. */}
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="h-full w-full object-cover"
          style={facingMode === "user" ? { transform: "scaleX(-1)" } : undefined}
          aria-label="Kamera selfie"
        />
        {!stream && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-500">
            {isCameraStarting ? "Menyalakan kamera…" : "Kamera belum aktif"}
          </div>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      <div className="flex items-center justify-between gap-3 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={facingMode === "environment"}
            onChange={(e) => setFacingMode(e.target.checked ? "environment" : "user")}
            className="rounded border-gray-300"
          />
          Kamera belakang
        </label>
        <div>{gpsBadge}</div>
      </div>

      <button
        type="button"
        onClick={handleCapture}
        disabled={!stream || isLoading}
        className="btn-primary w-full !min-h-[52px] text-base"
      >
        {isLoading ? "Memproses..." : "Ambil Foto"}
      </button>
      <button type="button" onClick={onCancel} className="btn-ghost w-full">
        Batal
      </button>
    </div>
  );
}
