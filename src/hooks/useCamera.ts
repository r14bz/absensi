"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface CameraState {
  stream: MediaStream | null;
  error: string | null;
  isSupported: boolean;
  isStarting: boolean;
  facingMode: "user" | "environment";
  setFacingMode: (mode: "user" | "environment") => void;
  start: () => Promise<void>;
  stop: () => void;
  capture: () => string | null; // data URL jpeg
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
}

/** Foto selfie cukup 640px: ~40-80KB, upload jauh lebih cepat di jaringan seluler. */
const CAPTURE_MAX_WIDTH = 640;
const JPEG_QUALITY = 0.75;

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

/**
 * Hook kamera (getUserMedia). Default kamera depan untuk selfie.
 * - Start otomatis saat mount & saat facingMode berubah; stop saat unmount.
 * - Stream dipasang ke <video> lewat effect, jadi tidak bergantung pada
 *   urutan render (elemen video boleh dirender belakangan).
 */
export function useCamera(): CameraState {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [isSupported, setIsSupported] = useState(true);

  // Dicek setelah mount agar SSR & client menghasilkan HTML awal yang sama.
  useEffect(() => {
    setIsSupported(typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia);
  }, []);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
  }, []);

  const start = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError(
        typeof window !== "undefined" && !window.isSecureContext
          ? "Kamera hanya bisa dipakai lewat HTTPS (atau localhost). Buka aplikasi dari alamat https://."
          : "Browser tidak mendukung kamera (getUserMedia)."
      );
      return;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setIsStarting(true);
    setError(null);
    try {
      let s: MediaStream;
      try {
        s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode }, width: { ideal: 960 }, height: { ideal: 720 } },
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
      streamRef.current = s;
      setStream(s);
    } catch (e) {
      setError(describeCameraError(e));
      setStream(null);
    } finally {
      setIsStarting(false);
    }
  }, [facingMode]);

  // Pasang stream ke elemen <video> setiap kali stream berubah.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    if (stream) {
      video.play().catch(() => {
        /* autoplay diblokir: atribut autoPlay+muted+playsInline sudah menangani kasus umum */
      });
    }
  }, [stream]);

  // Start saat mount / ganti kamera; hentikan saat unmount.
  useEffect(() => {
    void start();
    return () => stop();
  }, [start, stop]);

  const capture = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0 || video.videoHeight === 0) return null;
    const scale = Math.min(1, CAPTURE_MAX_WIDTH / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    if (facingMode === "user") {
      // Mirror agar hasil sama seperti pratinjau.
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  }, [facingMode]);

  return { stream, error, isSupported, isStarting, facingMode, setFacingMode, start, stop, capture, videoRef, canvasRef };
}
