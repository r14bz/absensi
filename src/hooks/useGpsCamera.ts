"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { distanceMeters, reverseGeocode, type GpsFix, type PlaceInfo } from "@/lib/gps-stamp/geo";
import { renderStampedPhoto } from "@/lib/gps-stamp/stampRenderer";
import { fetchWeather, type WeatherInfo } from "@/lib/gps-stamp/weather";

export type FacingMode = "user" | "environment";

export interface CapturedPhoto {
  blob: Blob;
  fix: GpsFix;
}

function describeCameraError(e: unknown): string {
  const name = e instanceof DOMException ? e.name : "";
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "Kamera hanya bisa dipakai lewat HTTPS (atau localhost). Buka aplikasi dari alamat https://.";
  }
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Izin kamera ditolak. Aktifkan izin kamera untuk situs ini di pengaturan browser, lalu coba lagi.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "Kamera tidak ditemukan di perangkat ini.";
    case "NotReadableError":
    case "AbortError":
      return "Kamera sedang dipakai aplikasi lain. Tutup aplikasi tersebut lalu coba lagi.";
    default:
      return e instanceof Error && e.message ? e.message : "Gagal mengakses kamera.";
  }
}

function describeGeoError(err: unknown): string {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "GPS hanya bisa dipakai lewat HTTPS (atau localhost). Buka aplikasi dari alamat https://.";
  }
  const code = (err as GeolocationPositionError | undefined)?.code;
  if (code === 1) return "Izin lokasi ditolak. Aktifkan izin lokasi untuk situs ini di pengaturan browser.";
  if (code === 2) return "Lokasi tidak tersedia. Pastikan GPS/Layanan Lokasi perangkat menyala.";
  if (code === 3) return "Permintaan lokasi timeout. Coba lagi di tempat dengan sinyal GPS lebih baik.";
  return "Gagal mendapatkan lokasi.";
}

function toFix(pos: GeolocationPosition): GpsFix {
  return {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    accuracy: pos.coords.accuracy,
    altitude: pos.coords.altitude,
    timestamp: pos.timestamp,
  };
}

/**
 * Kamera + GPS langsung (live) untuk absensi berstempel lokasi.
 * - Kamera: start otomatis, ganti kamera depan/belakang, senter (jika didukung).
 * - GPS: watchPosition akurasi tinggi (fallback akurasi rendah jika timeout di dalam gedung).
 * - Alamat & cuaca di-refresh hemat (hanya saat berpindah / berkala), bukan tiap update GPS.
 * - Lokasi HANYA dari sensor perangkat; tidak ada input/koreksi lokasi manual.
 */
export function useGpsCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const genRef = useRef(0); // token: membatalkan start() yang masih berjalan saat stop()/start() baru

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [facingMode, setFacingMode] = useState<FacingMode>("user");
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const [fix, setFix] = useState<GpsFix | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [geoSupported, setGeoSupported] = useState(true);
  const [geoNonce, setGeoNonce] = useState(0);
  const [place, setPlace] = useState<PlaceInfo | null>(null);
  const [weather, setWeather] = useState<WeatherInfo | null>(null);

  const cameraSupported = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

  // Nilai terbaru untuk dipakai saat capture tanpa membuat capture() berubah identitas.
  const fixRef = useRef<GpsFix | null>(null);
  const placeRef = useRef<PlaceInfo | null>(null);
  const weatherRef = useRef<WeatherInfo | null>(null);
  fixRef.current = fix;
  placeRef.current = place;
  weatherRef.current = weather;

  // ---------------- Kamera ----------------
  const stop = useCallback(() => {
    genRef.current++;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
    setTorchOn(false);
    setTorchSupported(false);
    setIsStarting(false);
  }, []);

  const start = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        typeof window !== "undefined" && !window.isSecureContext
          ? "Kamera hanya bisa dipakai lewat HTTPS (atau localhost). Buka aplikasi dari alamat https://."
          : "Browser tidak mendukung kamera (getUserMedia)."
      );
      return;
    }
    const gen = ++genRef.current;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setIsStarting(true);
    setCameraError(null);
    try {
      let s: MediaStream;
      try {
        s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (first) {
        // Constraint terlalu ketat di sebagian HP lama: ulangi tanpa constraint.
        if (first instanceof DOMException && first.name === "OverconstrainedError") {
          s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } else {
          throw first;
        }
      }
      if (gen !== genRef.current) {
        s.getTracks().forEach((t) => t.stop()); // dibatalkan saat menunggu izin
        return;
      }
      streamRef.current = s;
      const caps = s.getVideoTracks()[0]?.getCapabilities?.() as unknown as { torch?: boolean } | undefined;
      setTorchSupported(Boolean(caps?.torch));
      setTorchOn(false);
      setStream(s);
    } catch (e) {
      if (gen === genRef.current) {
        setCameraError(describeCameraError(e));
        setStream(null);
      }
    } finally {
      if (gen === genRef.current) setIsStarting(false);
    }
  }, [facingMode]);

  // Pasang stream ke <video>
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    if (stream) video.play().catch(() => {});
  }, [stream]);

  // Start saat mount / ganti kamera; hentikan saat unmount.
  useEffect(() => {
    void start();
    return () => stop();
  }, [start, stop]);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as unknown as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch {
      /* senter tidak bisa diaktifkan: biarkan status tetap */
    }
  }, [torchOn]);

  const flip = useCallback(() => setFacingMode((m) => (m === "user" ? "environment" : "user")), []);

  // ---------------- GPS ----------------
  useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setGeoSupported(false);
      setGeoError("Browser tidak mendukung geolocation.");
      return;
    }
    setGeoSupported(true);
    let cancelled = false;
    let gotFix = false;

    const onFix = (pos: GeolocationPosition) => {
      if (cancelled) return;
      gotFix = true;
      setFix(toFix(pos));
      setGeoError(null);
    };
    const onError = (err: GeolocationPositionError) => {
      if (cancelled) return;
      if (err.code === 1) {
        setGeoError(describeGeoError(err));
        return;
      }
      // Timeout/tidak tersedia (umum di dalam gedung): coba sekali lewat jaringan/WiFi.
      if (!gotFix) {
        navigator.geolocation.getCurrentPosition(
          onFix,
          (e2) => {
            if (!cancelled && !gotFix) setGeoError(describeGeoError(e2));
          },
          { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 }
        );
      }
    };

    const id = navigator.geolocation.watchPosition(onFix, onError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 3000,
    });
    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(id);
    };
  }, [geoNonce]);

  const retryGeo = useCallback(() => {
    setGeoError(null);
    setGeoNonce((n) => n + 1);
  }, []);

  // Alamat: hanya saat pindah >30 m (jeda min 5 dtk); ulang 15 dtk setelah gagal (hormati batas Nominatim).
  const lastPlaceReq = useRef<{ latitude: number; longitude: number; at: number; ok: boolean } | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (!fix) return;
    const last = lastPlaceReq.current;
    const now = Date.now();
    const needs =
      !last ||
      (last.ok && distanceMeters(last, fix) >= 30 && now - last.at >= 5000) ||
      (!last.ok && now - last.at >= 15000);
    if (!needs) return;

    const entry = { latitude: fix.latitude, longitude: fix.longitude, at: now, ok: false };
    lastPlaceReq.current = entry;
    void reverseGeocode(fix.latitude, fix.longitude).then((p) => {
      if (!alive.current) return;
      if (p) {
        entry.ok = true;
        setPlace(p);
      }
    });
  }, [fix]);

  // Cuaca: saat pindah >1 km atau tiap 10 menit; ulang 30 dtk setelah gagal.
  const lastWeatherReq = useRef<{ latitude: number; longitude: number; at: number; ok: boolean } | null>(null);
  useEffect(() => {
    if (!fix) return;
    const last = lastWeatherReq.current;
    const now = Date.now();
    const needs =
      !last ||
      (last.ok && (distanceMeters(last, fix) >= 1000 || now - last.at >= 10 * 60 * 1000)) ||
      (!last.ok && now - last.at >= 30000);
    if (!needs) return;

    const entry = { latitude: fix.latitude, longitude: fix.longitude, at: now, ok: false };
    lastWeatherReq.current = entry;
    void fetchWeather(fix.latitude, fix.longitude).then((w) => {
      if (!alive.current) return;
      if (w) {
        entry.ok = true;
        setWeather(w);
      }
    });
  }, [fix]);

  // ---------------- Capture ----------------
  const capture = useCallback(async (): Promise<CapturedPhoto | null> => {
    const video = videoRef.current;
    const currentFix = fixRef.current;
    if (!video || !currentFix || video.videoWidth === 0 || video.videoHeight === 0) return null;
    const blob = await renderStampedPhoto({
      video,
      mirrored: facingMode === "user",
      fix: currentFix,
      place: placeRef.current,
      weather: weatherRef.current,
      capturedAt: new Date(),
    });
    return { blob, fix: currentFix };
  }, [facingMode]);

  return {
    videoRef,
    stream,
    cameraError,
    cameraSupported,
    isStarting,
    facingMode,
    flip,
    startCamera: start,
    stopCamera: stop,
    torchSupported,
    torchOn,
    toggleTorch,
    fix,
    place,
    weather,
    geoError,
    geoSupported,
    retryGeo,
    capture,
  };
}
