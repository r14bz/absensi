import { getWorkDateInTimezone } from "@/lib/timezone";

type Row = {
  id: string;
  work_date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  shift?: string | null;
  [k: string]: unknown;
};

/** Tanggal kemarin (YYYY-MM-DD) relatif terhadap tanggal kerja `today`. */
export function previousDate(today: string): string {
  const [y, m, d] = today.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d - 1));
  return dt.toISOString().slice(0, 10);
}

/**
 * Shift MALAM masuk malam hari dan pulang setelah lewat tengah malam,
 * sehingga barisnya ada di tanggal KEMARIN. Fungsi ini memilih baris
 * absensi yang "sedang berjalan" untuk user:
 *  1. baris hari ini yang sudah check-in, atau
 *  2. baris kemarin shift MALAM yang belum check-out, atau
 *  3. baris hari ini (belum check-in) / null.
 */
export async function findActiveRecord(
  supabase: any,
  userId: string,
  columns = "*",
  now: Date = new Date()
): Promise<{ record: Row | null; today: string; overnight: boolean; error: boolean }> {
  const today = getWorkDateInTimezone(now);
  const yesterday = previousDate(today);
  const { data, error } = await supabase
    .from("attendance_records")
    .select(columns.includes("*") ? columns : `${columns}, work_date, check_in_at, check_out_at, shift`)
    .eq("user_id", userId)
    .in("work_date", [today, yesterday]);
  if (error) return { record: null, today, overnight: false, error: true };

  const rows = (data ?? []) as Row[];
  const todayRow = rows.find((r) => r.work_date === today) ?? null;
  const yRow = rows.find((r) => r.work_date === yesterday) ?? null;

  if (todayRow?.check_in_at) return { record: todayRow, today, overnight: false, error: false };
  if (yRow?.check_in_at && !yRow.check_out_at && yRow.shift === "MALAM") {
    return { record: yRow, today, overnight: true, error: false };
  }
  return { record: todayRow, today, overnight: false, error: false };
}
