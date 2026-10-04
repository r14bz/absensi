/**
 * Peta kecil untuk stempel GPS (template "Lengkap + Peta").
 * Tile dari OpenStreetMap (gratis, tanpa API key). Jika tile gagal dimuat
 * (offline / diblokir), peta dilewati: TIDAK ada gambar peta pengganti/palsu.
 * Atribusi "© OpenStreetMap" selalu ikut tergambar sesuai ketentuan OSM.
 */

export const TILE_SIZE = 256;
/** Zoom 17 ≈ 1,2 m/piksel: cukup detail untuk melihat posisi di jalan/gedung. */
export const MAP_ZOOM = 17;
/** Jendela peta dalam "piksel dunia" pada MAP_ZOOM (± 230 m). Dipakai sama oleh pratinjau & foto. */
export const MAP_WINDOW = 192;
export const MARKER_RADIUS = 11;

export interface PlannedTile {
  url: string;
  /** Posisi kiri-atas tile relatif ke jendela peta (piksel dunia). */
  dx: number;
  dy: number;
}

/** Koordinat lat/lon -> piksel dunia (Web Mercator) pada zoom tertentu. */
export function worldPixel(lat: number, lon: number, zoom: number): { x: number; y: number } {
  const scale = TILE_SIZE * 2 ** zoom;
  const x = ((lon + 180) / 360) * scale;
  const sin = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999);
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale;
  return { x, y };
}

export function metersPerPixel(lat: number, zoom: number): number {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
}

/** Radius lingkaran akurasi dalam piksel jendela peta (dibatasi agar tetap terlihat di dalam peta). */
export function accuracyRadiusPx(lat: number, accuracyMeters: number): number {
  if (!Number.isFinite(accuracyMeters) || accuracyMeters <= 0) return 0;
  return Math.min(accuracyMeters / metersPerPixel(lat, MAP_ZOOM), MAP_WINDOW / 2 - 6);
}

/** Tile apa saja yang menutupi jendela peta yang berpusat di (lat, lon). */
export function planTiles(lat: number, lon: number, size = MAP_WINDOW, zoom = MAP_ZOOM): PlannedTile[] {
  const c = worldPixel(lat, lon, zoom);
  const left = c.x - size / 2;
  const top = c.y - size / 2;
  const n = 2 ** zoom;
  const x0 = Math.floor(left / TILE_SIZE);
  const x1 = Math.floor((left + size - 1) / TILE_SIZE);
  const y0 = Math.floor(top / TILE_SIZE);
  const y1 = Math.floor((top + size - 1) / TILE_SIZE);

  const tiles: PlannedTile[] = [];
  for (let ty = y0; ty <= y1; ty++) {
    if (ty < 0 || ty >= n) continue;
    for (let tx = x0; tx <= x1; tx++) {
      const wrappedX = ((tx % n) + n) % n;
      tiles.push({
        url: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${ty}.png`,
        dx: tx * TILE_SIZE - left,
        dy: ty * TILE_SIZE - top,
      });
    }
  }
  return tiles;
}

function loadImage(url: string, timeoutMs = 5000): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // wajib agar canvas tidak "tainted" saat dijadikan JPEG
    const timer = setTimeout(() => resolve(null), timeoutMs);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = url;
  });
}

/**
 * Gambar peta persegi (pixelSize x pixelSize) lengkap dengan lingkaran akurasi,
 * penanda posisi, dan atribusi. Mengembalikan null jika tidak ada satu pun tile yang berhasil dimuat.
 */
export async function renderMapCanvas(
  lat: number,
  lon: number,
  accuracyMeters: number,
  pixelSize: number
): Promise<HTMLCanvasElement | null> {
  const size = Math.max(32, Math.round(pixelSize));
  const plan = planTiles(lat, lon);
  const images = await Promise.all(plan.map((t) => loadImage(t.url)));
  if (!images.some(Boolean)) return null;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const s = size / MAP_WINDOW;
  ctx.scale(s, s);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.fillStyle = "#e5e7eb";
  ctx.fillRect(0, 0, MAP_WINDOW, MAP_WINDOW);
  plan.forEach((t, i) => {
    const img = images[i];
    if (img) ctx.drawImage(img, t.dx, t.dy, TILE_SIZE, TILE_SIZE);
  });

  const c = MAP_WINDOW / 2;

  // Lingkaran akurasi GPS
  const r = accuracyRadiusPx(lat, accuracyMeters);
  if (r >= 6) {
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(56,189,248,0.25)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(56,189,248,0.85)";
    ctx.stroke();
  }

  // Penanda posisi
  ctx.beginPath();
  ctx.arc(c, c, MARKER_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = "#ef4444";
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();

  // Atribusi OpenStreetMap
  const label = "© OpenStreetMap";
  ctx.font = "10px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
  const w = ctx.measureText(label).width + 8;
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.fillRect(MAP_WINDOW - w, MAP_WINDOW - 14, w, 14);
  ctx.fillStyle = "#374151";
  ctx.textBaseline = "middle";
  ctx.fillText(label, MAP_WINDOW - w + 4, MAP_WINDOW - 7);

  return canvas;
}
