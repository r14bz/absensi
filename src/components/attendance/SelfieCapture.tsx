"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useGpsCamera } from "@/hooks/useGpsCamera";
import {
  accuracyLabel,
  accuracyTone,
  formatAccuracy,
  formatAltitude,
  formatCoordinates,
  type GpsFix,
  type PlaceInfo,
} from "@/lib/gps-stamp/geo";
import { playShutter } from "@/lib/gps-stamp/sound";
import { formatStampTime } from "@/lib/gps-stamp/stampRenderer";
import { formatWeatherLine, type WeatherInfo } from "@/lib/gps-stamp/weather";
import { uploadSelfieClient } from "@/lib/storage/selfie-client";
import { getBrowserClient } from "@/lib/supabase/client";

interface SelfieCaptureProps {
  onCapture: (data: { photoPath: string; latitude: number; longitude: number }) => void;
  onCancel: () => void;
  method: "SELFIE" | "BIOMETRIC";
  isLoading?: boolean;
}

const TONE_TEXT = { good: "text-emerald-300", fair: "text-amber-300", poor: "text-red-300" } as const;
const TONE_DOT = { good: "bg-emerald-400", fair: "bg-amber-400", poor: "bg-red-400" } as const;

function Icon({ d, className = "h-5 w-5" }: { d: string; className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

const ICON_CLOSE = "M6 18L18 6M6 6l12 12";
const ICON_FLIP =
  "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15";
const ICON_BOLT = "M13 10V3L4 14h7v7l9-11h-7z";
const ICON_SPEAKER =
  "M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z";
const ICON_MUTED =
  "M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2";

const ROUND_BTN =
  "flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white/90 backdrop-blur-md transition active:scale-90";

/**
 * Overlay stempel langsung. Jam berjalan hanya me-render komponen ini
 * (bukan seluruh kamera) tiap detik.
 */
const LiveStamp = memo(function LiveStamp({
  fix,
  place,
  weather,
}: {
  fix: GpsFix | null;
  place: PlaceInfo | null;
  weather: WeatherInfo | null;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const tone = accuracyTone(fix?.accuracy ?? null);
  const alt = fix ? formatAltitude(fix.altitude) : null;

  return (
    <div className="pointer-events-none absolute inset-x-2 bottom-2 z-10">
      <div className="rounded-2xl border-l-4 border-sky-400 bg-gradient-to-t from-black/85 via-black/55 to-transparent p-3.5 text-white shadow-2xl">
        <p className="line-clamp-1 text-sm font-extrabold uppercase tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
          📍 {place?.city ? `${place.city}${place.country ? `, ${place.country}` : ""}` : fix ? "Lokasi GPS" : "Menentukan lokasi…"}
        </p>
        {place?.address && (
          <p className="mt-1 line-clamp-2 text-xs font-medium leading-snug text-slate-100 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
            {place.address}
          </p>
        )}
        {fix && (
          <p className="mt-1.5 font-mono text-xs font-bold text-sky-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
            KOORDINAT: {formatCoordinates(fix.latitude, fix.longitude)}
          </p>
        )}
        <p className="mt-1 text-[11px] font-medium text-slate-200 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]" suppressHydrationWarning>
          🕒 {formatStampTime(now)}
        </p>
        {weather && (
          <p className="mt-1 text-[10.5px] font-medium text-slate-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
            {formatWeatherLine(weather)}
          </p>
        )}
        {fix && (
          <p className={`mt-1.5 border-t border-white/15 pt-1 font-mono text-[11px] font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] ${TONE_TEXT[tone]}`}>
            🎯 AKURASI GPS: {formatAccuracy(fix.accuracy)} ({accuracyLabel(fix.accuracy)}){alt ? ` · ⛰️ ${alt}` : ""}
          </p>
        )}
      </div>
    </div>
  );
});

export default function SelfieCapture({ onCapture, onCancel, method, isLoading }: SelfieCaptureProps) {
  const cam = useGpsCamera();
  const { stopCamera, startCamera, capture } = cam;

  const [photo, setPhoto] = useState<{ blob: Blob; url: string; fix: GpsFix } | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [flash, setFlash] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Bebaskan object URL pratinjau saat diganti / komponen dilepas.
  const urlRef = useRef<string | null>(null);
  useEffect(() => {
    urlRef.current = photo?.url ?? null;
  }, [photo]);
  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    []
  );

  const handleShutter = useCallback(async () => {
    if (capturing) return;
    if (!cam.fix) {
      setError("Lokasi GPS belum didapat. Tunggu status GPS muncul di bagian atas.");
      return;
    }
    setCapturing(true);
    setError(null);
    setFlash(true);
    setTimeout(() => setFlash(false), 150);
    if (soundOn) playShutter();
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(50);

    try {
      const result = await capture();
      if (!result) throw new Error("Gagal menangkap foto. Pastikan kamera sudah menampilkan gambar.");
      setPhoto({ blob: result.blob, url: URL.createObjectURL(result.blob), fix: result.fix });
      stopCamera(); // hemat baterai & matikan lampu kamera selama pratinjau
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengambil foto.");
    } finally {
      setCapturing(false);
    }
  }, [capturing, cam.fix, soundOn, capture, stopCamera]);

  const handleRetake = useCallback(() => {
    if (photo) URL.revokeObjectURL(photo.url);
    setPhoto(null);
    setError(null);
    void startCamera();
  }, [photo, startCamera]);

  const handleConfirm = useCallback(async () => {
    if (!photo || uploading) return;
    setUploading(true);
    setError(null);
    try {
      const file = new File([photo.blob], "selfie.jpg", { type: "image/jpeg" });
      const supabase = getBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession(); // lokal (cookie), tanpa round-trip jaringan
      const userId = session?.user?.id;
      if (!userId) throw new Error("Sesi berakhir. Silakan login ulang.");

      const { path, error: uploadError } = await uploadSelfieClient(userId, file);
      if (uploadError || !path) throw new Error(uploadError ?? "Upload gagal: path kosong");

      onCapture({ photoPath: path, latitude: photo.fix.latitude, longitude: photo.fix.longitude });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengunggah foto.");
    } finally {
      setUploading(false);
    }
  }, [photo, uploading, onCapture]);

  const tone = accuracyTone(cam.fix?.accuracy ?? null);
  const busy = uploading || Boolean(isLoading);

  return (
    <div
      className="fixed inset-0 z-[60] flex h-[100dvh] flex-col bg-black text-white select-none"
      role="dialog"
      aria-modal="true"
      aria-label={method === "SELFIE" ? "Kamera absensi dengan stempel GPS" : "Verifikasi wajah dengan stempel GPS"}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Bar atas: status GPS + kontrol kamera */}
      <header
        className="flex shrink-0 items-center justify-between gap-2 px-4 pb-2"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <div className="flex min-w-0 items-center gap-1.5 rounded-full border border-white/20 bg-black/60 px-3 py-1.5 text-xs shadow-lg">
          {cam.fix ? (
            <>
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${TONE_DOT[tone]} ${photo ? "" : "animate-pulse"}`} />
              <span className={`font-bold ${TONE_TEXT[tone]}`}>{formatAccuracy(cam.fix.accuracy)}</span>
              <span className="truncate text-[10px] font-medium text-zinc-300">GPS {accuracyLabel(cam.fix.accuracy)}</span>
            </>
          ) : (
            <>
              <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-amber-400" />
              <span className="font-medium text-amber-300">{cam.geoError ? "GPS belum aktif" : "Mencari lokasi…"}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!photo && cam.torchSupported && (
            <button
              type="button"
              onClick={() => void cam.toggleTorch()}
              className={`${ROUND_BTN} ${cam.torchOn ? "!border-amber-300 !bg-amber-400 !text-black" : ""}`}
              aria-label="Senter"
              aria-pressed={cam.torchOn}
            >
              <Icon d={ICON_BOLT} />
            </button>
          )}
          {!photo && (
            <button type="button" onClick={() => setSoundOn((v) => !v)} className={ROUND_BTN} aria-label="Suara rana" aria-pressed={soundOn}>
              <Icon d={soundOn ? ICON_SPEAKER : ICON_MUTED} />
            </button>
          )}
          {!photo && (
            <button type="button" onClick={cam.flip} className={ROUND_BTN} aria-label="Ganti kamera depan/belakang">
              <Icon d={ICON_FLIP} />
            </button>
          )}
          <button type="button" onClick={onCancel} className={ROUND_BTN} aria-label="Tutup kamera" disabled={busy}>
            <Icon d={ICON_CLOSE} />
          </button>
        </div>
      </header>

      {/* Viewfinder / pratinjau */}
      <div className="relative min-h-0 flex-1 overflow-hidden bg-zinc-950">
        {/* <video> SELALU dirender agar ref siap saat stream datang / diulang. */}
        <video
          ref={cam.videoRef}
          autoPlay
          muted
          playsInline
          className="h-full w-full object-cover"
          style={cam.facingMode === "user" ? { transform: "scaleX(-1)" } : undefined}
          aria-label="Kamera"
        />

        {!photo && !cam.stream && !cam.cameraError && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-400">
            {!cam.cameraSupported ? "Browser tidak mendukung akses kamera." : cam.isStarting ? "Menyalakan kamera…" : "Kamera belum aktif"}
          </div>
        )}

        {cam.cameraError && !photo && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-zinc-950/90 p-6 text-center">
            <p className="mb-1 text-base font-semibold">Kamera Diperlukan</p>
            <p className="mb-4 max-w-xs text-xs leading-relaxed text-zinc-400">{cam.cameraError}</p>
            <button type="button" onClick={() => void startCamera()} className="btn-primary">
              Aktifkan Kamera
            </button>
          </div>
        )}

        {cam.geoError && !photo && (
          <div role="alert" className="alert-error absolute inset-x-2 top-2 z-20 flex items-center justify-between gap-2 !py-2 text-xs">
            <span>{cam.geoError}</span>
            <button type="button" onClick={cam.retryGeo} className="shrink-0 rounded-lg border border-red-400/50 px-2 py-1 font-semibold">
              Coba Lagi
            </button>
          </div>
        )}

        {!photo && <LiveStamp fix={cam.fix} place={cam.place} weather={cam.weather} />}

        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.url} alt="Hasil foto dengan stempel GPS" className="absolute inset-0 z-10 h-full w-full bg-black object-contain" />
        )}

        {flash && <div className="pointer-events-none absolute inset-0 z-30 bg-white/90" />}
      </div>

      {/* Bar bawah: rana / aksi pratinjau */}
      <footer
        className="shrink-0 px-6 pt-3"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        {error && (
          <div role="alert" className="alert-error mb-3 text-xs">
            {error}
          </div>
        )}

        {photo ? (
          <div className="flex gap-2">
            <button type="button" onClick={handleRetake} disabled={busy} className="btn-ghost flex-1 !min-h-[52px] !border-white/30 !text-white hover:!bg-white/10">
              Ambil Ulang
            </button>
            <button type="button" onClick={() => void handleConfirm()} disabled={busy} className="btn-primary flex-1 !min-h-[52px]">
              {busy ? "Mengirim..." : "Gunakan Foto Ini"}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <button type="button" onClick={onCancel} className="w-16 text-sm font-medium text-zinc-300 active:opacity-70">
              Batal
            </button>
            <button
              type="button"
              onClick={() => void handleShutter()}
              disabled={!cam.stream || !cam.fix || capturing || Boolean(isLoading)}
              className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white transition active:scale-95 disabled:opacity-40"
              aria-label="Ambil foto"
            >
              <span className={`h-16 w-16 rounded-full transition ${capturing ? "scale-90 bg-sky-400" : "bg-white"}`} />
            </button>
            <span className="w-16" aria-hidden="true" />
          </div>
        )}
        {!photo && !cam.fix && !cam.geoError && (
          <p className="mt-2 text-center text-[11px] text-zinc-400">Tombol foto aktif setelah lokasi GPS didapat.</p>
        )}
      </footer>
    </div>
  );
}
