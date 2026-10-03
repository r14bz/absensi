"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface GeoPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export interface GeolocationState {
  position: GeoPosition | null;
  error: string | null;
  isSupported: boolean;
  isLoading: boolean;
  getCurrentPosition: () => Promise<GeoPosition | null>;
}

function toGeo(pos: GeolocationPosition): GeoPosition {
  return {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    accuracy: pos.coords.accuracy,
    timestamp: pos.timestamp,
  };
}

function ask(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, options));
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

/**
 * Hook GPS. getCurrentPosition identitasnya STABIL (tidak berubah antar render)
 * sehingga aman dipakai di dependency effect.
 * Strategi: coba akurasi tinggi dulu; jika gagal/timeout (umum di dalam
 * gedung) ulangi dengan akurasi rendah (jaringan/WiFi) sebelum menyerah.
 */
export function useGeolocation(): GeolocationState {
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    setIsSupported(typeof navigator !== "undefined" && "geolocation" in navigator);
    return () => {
      mounted.current = false;
    };
  }, []);

  const getCurrentPosition = useCallback(async (): Promise<GeoPosition | null> => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setError("Browser tidak mendukung geolocation.");
      return null;
    }
    setIsLoading(true);
    setError(null);
    try {
      let raw: GeolocationPosition;
      try {
        raw = await ask({ enableHighAccuracy: true, timeout: 8000, maximumAge: 15000 });
      } catch (first) {
        // Izin ditolak: tidak ada gunanya mengulang.
        if ((first as GeolocationPositionError).code === 1) throw first;
        raw = await ask({ enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 });
      }
      const geo = toGeo(raw);
      if (mounted.current) setPosition(geo);
      return geo;
    } catch (e) {
      if (mounted.current) setError(describeGeoError(e));
      return null;
    } finally {
      if (mounted.current) setIsLoading(false);
    }
  }, []);

  return { position, error, isSupported, isLoading, getCurrentPosition };
}
