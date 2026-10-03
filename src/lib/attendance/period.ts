/**
 * Periode pembukuan absensi: tanggal 21 bulan sebelumnya s/d tanggal 20
 * bulan berjalan. Periode DINAMAI menurut bulan tempat ia BERAKHIR:
 *   "Oktober 2026" = 21 Sep 2026 s/d 20 Okt 2026.
 *
 * Pure & tanpa dependency, aman dipakai di server maupun client.
 */
export const PERIOD_START_DAY = 21;
export const PERIOD_END_DAY = PERIOD_START_DAY - 1; // 20

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

const p2 = (n: number) => String(n).padStart(2, "0");

export interface Period {
  year: number; // tahun bulan akhir periode
  month: number; // 1-12, bulan akhir periode
  start: string; // YYYY-MM-DD (tgl 21 bulan sebelumnya)
  end: string; // YYYY-MM-DD (tgl 20)
}

export function getPeriod(year: number, month: number): Period {
  const prev = new Date(Date.UTC(year, month - 2, 1));
  return {
    year,
    month,
    start: `${prev.getUTCFullYear()}-${p2(prev.getUTCMonth() + 1)}-${p2(PERIOD_START_DAY)}`,
    end: `${year}-${p2(month)}-${p2(PERIOD_END_DAY)}`,
  };
}

/** Periode yang memuat tanggal tertentu (YYYY-MM-DD). Tgl >= 21 masuk periode bulan berikutnya. */
export function getPeriodForDate(dateStr: string): Period {
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  const endMonth = d >= PERIOD_START_DAY ? new Date(Date.UTC(y, m, 1)) : new Date(Date.UTC(y, m - 1, 1));
  return getPeriod(endMonth.getUTCFullYear(), endMonth.getUTCMonth() + 1);
}

/** Geser periode sebanyak `delta` bulan. */
export function shiftPeriod(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

/** Daftar tanggal YYYY-MM-DD dari start s/d end (inklusif). */
export function listDates(start: string, end: string): string[] {
  const [y, m, d] = start.split("-").map(Number) as [number, number, number];
  const out: string[] = [];
  const cur = new Date(Date.UTC(y, m - 1, d));
  for (let i = 0; i < 400; i++) {
    const s = `${cur.getUTCFullYear()}-${p2(cur.getUTCMonth() + 1)}-${p2(cur.getUTCDate())}`;
    if (s > end) break;
    out.push(s);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

export function periodName(year: number, month: number): string {
  return `${MONTHS[month - 1] ?? month} ${year}`;
}

/** "21 Sep 2026 – 20 Okt 2026" */
export function formatPeriodRange(period: Pick<Period, "start" | "end">): string {
  const f = (s: string) => {
    const [y, m, d] = s.split("-").map(Number) as [number, number, number];
    return `${d} ${MONTHS_SHORT[m - 1]} ${y}`;
  };
  return `${f(period.start)} – ${f(period.end)}`;
}

export function isValidYearMonth(year: number, month: number): boolean {
  return Number.isInteger(year) && year >= 2000 && year <= 2100 && Number.isInteger(month) && month >= 1 && month <= 12;
}
