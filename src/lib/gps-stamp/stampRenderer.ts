import { APP_TIMEZONE } from "@/lib/timezone";
import {
  accuracyLabel,
  accuracyTone,
  formatAccuracy,
  formatAltitude,
  formatCoordinates,
  type GpsFix,
  type PlaceInfo,
} from "./geo";
import { formatWeatherLine, type WeatherInfo } from "./weather";

/** Sisi terpanjang foto hasil (px). Cukup tajam untuk stempel, tetap ringan di jaringan seluler. */
const MAX_SIDE = 1280;
const JPEG_QUALITY = 0.85;

const TZ_LABEL: Record<string, string> = {
  "Asia/Jakarta": "WIB",
  "Asia/Pontianak": "WIB",
  "Asia/Makassar": "WITA",
  "Asia/Jayapura": "WIT",
};

/** "Senin, 04/10/2026 08:15:30 WIB" di APP_TIMEZONE (bukan zona waktu perangkat). */
export function formatStampTime(date: Date): string {
  const parts = new Intl.DateTimeFormat("id-ID", {
    timeZone: APP_TIMEZONE,
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  const tz = TZ_LABEL[APP_TIMEZONE] ?? APP_TIMEZONE;
  return `${get("weekday")}, ${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}:${get("second")} ${tz}`;
}

interface Row {
  text: string;
  size: number;
  weight: string;
  color: string;
  family: string;
  maxLines: number;
}

const SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const MONO = "ui-monospace, Menlo, Consolas, monospace";
const TONE_COLOR = { good: "#4ade80", fair: "#fbbf24", poor: "#f87171" } as const;

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);

  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1] ?? "";
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    kept[maxLines - 1] = `${last}…`;
    return kept;
  }
  return lines;
}

export interface StampInput {
  video: HTMLVideoElement;
  /** true untuk kamera depan: gambar dicerminkan agar sama dengan pratinjau, teks tetap normal. */
  mirrored: boolean;
  fix: GpsFix;
  place: PlaceInfo | null;
  weather: WeatherInfo | null;
  capturedAt: Date;
}

/** Ambil frame video, tempelkan stempel GPS (lokasi, koordinat, waktu, cuaca, akurasi), kembalikan JPEG. */
export async function renderStampedPhoto(input: StampInput): Promise<Blob> {
  const { video, mirrored, fix, place, weather, capturedAt } = input;
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) throw new Error("Kamera belum menampilkan gambar.");

  const k = Math.min(1, MAX_SIDE / Math.max(vw, vh));
  const cw = Math.round(vw * k);
  const ch = Math.round(vh * k);

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas tidak tersedia di perangkat ini.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // 1) Gambar kamera
  ctx.save();
  if (mirrored) {
    ctx.translate(cw, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, cw, ch);
  ctx.restore();

  // 2) Susun baris stempel (baris tanpa data dilewati, tidak diisi data palsu)
  const u = cw / 800; // satuan skala: semua ukuran proporsional terhadap lebar foto
  const margin = 28 * u;
  const barW = Math.max(4, 5 * u);
  const contentX = margin + barW + 18 * u;
  const maxTextW = cw - contentX - margin;
  const padY = 16 * u;

  const tone = accuracyTone(fix.accuracy);
  const alt = formatAltitude(fix.altitude);
  const rows: Row[] = [];

  rows.push({
    text: place?.city ? `📍 ${place.city.toUpperCase()}${place.country ? `, ${place.country.toUpperCase()}` : ""}` : "📍 LOKASI GPS",
    size: 28 * u, weight: "800", color: "#ffffff", family: SANS, maxLines: 1,
  });
  if (place?.address) {
    rows.push({ text: place.address, size: 19 * u, weight: "600", color: "#f8fafc", family: SANS, maxLines: 2 });
  }
  rows.push({
    text: `KOORDINAT: ${formatCoordinates(fix.latitude, fix.longitude)}`,
    size: 20 * u, weight: "700", color: "#38bdf8", family: MONO, maxLines: 1,
  });
  rows.push({
    text: `🕒 ${formatStampTime(capturedAt)}`,
    size: 19 * u, weight: "600", color: "#f1f5f9", family: SANS, maxLines: 1,
  });
  if (weather) {
    rows.push({ text: formatWeatherLine(weather), size: 17 * u, weight: "600", color: "#e2e8f0", family: SANS, maxLines: 2 });
  }
  rows.push({
    text: `🎯 AKURASI GPS: ${formatAccuracy(fix.accuracy)} (${accuracyLabel(fix.accuracy)})${alt ? `  |  ⛰️ ${alt}` : ""}`,
    size: 17 * u, weight: "700", color: TONE_COLOR[tone], family: SANS, maxLines: 2,
  });

  const laidOut = rows.map((row) => {
    ctx.font = `${row.weight} ${Math.round(row.size)}px ${row.family}`;
    return { row, lines: wrapText(ctx, row.text, maxTextW, row.maxLines) };
  });
  const lineH = (row: Row) => row.size * 1.35;
  const contentH = laidOut.reduce((sum, { row, lines }) => sum + lines.length * lineH(row), 0);
  const totalH = contentH + padY * 2;
  const top = ch - margin * 0.6 - totalH;

  // 3) Gradasi gelap lembut di bawah agar teks terbaca
  const grad = ctx.createLinearGradient(0, top - 60 * u, 0, ch);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(0.3, "rgba(0,0,0,0.5)");
  grad.addColorStop(1, "rgba(0,0,0,0.8)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, top - 60 * u, cw, ch - (top - 60 * u));

  // 4) Bar aksen + teks
  ctx.fillStyle = "#38bdf8";
  ctx.fillRect(margin, top + padY * 0.5, barW, totalH - padY);

  ctx.textBaseline = "top";
  ctx.shadowColor = "rgba(0,0,0,0.95)";
  ctx.shadowBlur = 8 * u;
  ctx.shadowOffsetX = 1.5 * u;
  ctx.shadowOffsetY = 1.5 * u;

  let y = top + padY;
  for (const { row, lines } of laidOut) {
    ctx.font = `${row.weight} ${Math.round(row.size)}px ${row.family}`;
    ctx.fillStyle = row.color;
    for (const line of lines) {
      ctx.fillText(line, contentX, y);
      y += lineH(row);
    }
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Gagal membuat gambar."))),
      "image/jpeg",
      JPEG_QUALITY
    );
  });
}
