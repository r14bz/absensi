/**
 * Semua logika tanggal bisnis memakai satu timezone (APP_TIMEZONE),
 * dihitung dengan Intl bawaan runtime — tanpa dependency tambahan.
 * JANGAN gunakan timezone browser/server untuk menentukan work_date.
 */
export const APP_TIMEZONE =
  process.env.NEXT_PUBLIC_TIMEZONE || "Asia/Jakarta";

/** work_date (YYYY-MM-DD) untuk sebuah instant, di APP_TIMEZONE. */
export function getWorkDateInTimezone(instant: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** Jam lokal "HH:mm" di APP_TIMEZONE (untuk tampilan). */
export function formatLocalTime(instant: Date | string | null): string {
  if (!instant) return "--:--";
  const date = typeof instant === "string" ? new Date(instant) : instant;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Hari dalam minggu (0=Minggu..6=Sabtu) di APP_TIMEZONE. */
export function getLocalWeekday(instant: Date = new Date()): number {
  const short = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    weekday: "short",
  }).format(instant);
  return WEEKDAYS.indexOf(short);
}

export function isWeekend(instant: Date = new Date()): boolean {
  const d = getLocalWeekday(instant);
  return d === 0 || d === 6;
}

/** Hari dalam minggu untuk string kalender "YYYY-MM-DD" (tidak tergantung timezone). */
export function weekdayOfDateString(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Selisih offset (menit) APP_TIMEZONE terhadap UTC pada instant tertentu. */
function tzOffsetMinutes(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60000);
}

/** Ubah "tanggal + HH:mm lokal APP_TIMEZONE" menjadi instant UTC yang benar. */
export function zonedDateTimeToUtc(dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  const [hh, mm] = timeStr.split(":").map(Number) as [number, number];
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  return new Date(guess - tzOffsetMinutes(new Date(guess)) * 60000);
}
