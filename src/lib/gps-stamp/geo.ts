/**
 * Util lokasi untuk stempel GPS pada foto absensi.
 * Alamat dari OpenStreetMap Nominatim (gratis, tanpa API key).
 * Catatan: jika layanan gagal/offline, fungsi mengembalikan null dan stempel
 * hanya memuat koordinat — TIDAK ada data pengganti/palsu.
 */

export interface GpsFix {
  latitude: number;
  longitude: number;
  /** Akurasi dalam meter (radius). */
  accuracy: number;
  altitude: number | null;
  timestamp: number;
}

export interface PlaceInfo {
  address: string;
  city: string;
  country: string;
}

export type AccuracyTone = "good" | "fair" | "poor";

export function formatCoordinates(lat: number, lon: number): string {
  const latStr = `${Math.abs(lat).toFixed(6)}° ${lat >= 0 ? "N" : "S"}`;
  const lonStr = `${Math.abs(lon).toFixed(6)}° ${lon >= 0 ? "E" : "W"}`;
  return `${latStr}, ${lonStr}`;
}

export function formatAccuracy(accuracy: number | null): string {
  if (accuracy === null || !Number.isFinite(accuracy)) return "n/a";
  return `±${Math.round(accuracy)} m`;
}

export function formatAltitude(altitude: number | null): string | null {
  if (altitude === null || !Number.isFinite(altitude)) return null;
  return `${Math.round(altitude)} m`;
}

export function accuracyTone(accuracy: number | null): AccuracyTone {
  if (accuracy === null || !Number.isFinite(accuracy)) return "poor";
  if (accuracy <= 30) return "good";
  if (accuracy <= 100) return "fair";
  return "poor";
}

export function accuracyLabel(accuracy: number | null): string {
  if (accuracy === null || !Number.isFinite(accuracy)) return "Tidak diketahui";
  if (accuracy <= 10) return "Sangat Akurat";
  if (accuracy <= 30) return "Baik";
  if (accuracy <= 100) return "Standar";
  return "Rendah";
}

/** Jarak dua titik (meter), rumus haversine. */
export function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

interface NominatimResponse {
  display_name?: string;
  address?: Record<string, string | undefined>;
}

const geocodeCache = new Map<string, PlaceInfo>();

export async function reverseGeocode(lat: number, lon: number): Promise<PlaceInfo | null> {
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  const cached = geocodeCache.get(key);
  if (cached) return cached;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
      { signal: controller.signal, headers: { "Accept-Language": "id" } }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as NominatimResponse;
    const a = data.address ?? {};

    const road = a.road || a.pedestrian || a.street || a.residential || "";
    const suburb = a.suburb || a.neighbourhood || a.village || a.quarter || "";
    const city = a.city || a.town || a.municipality || a.county || a.state_district || "";
    const state = a.state || a.province || a.region || "";
    const country = a.country || "";

    const parts = [road, suburb, city, state, country].filter(Boolean);
    const address = parts.length > 0 ? parts.join(", ") : data.display_name || "";
    if (!address) return null;

    const place: PlaceInfo = { address, city, country };
    geocodeCache.set(key, place);
    return place;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
