import { getAuthenticatedProfile, getServerClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/validation/attendance";
import { getPeriod, isValidYearMonth } from "@/lib/attendance/period";
import { buildMonth } from "@/lib/server/month";
import { isMissingColumn } from "@/lib/server/db-errors";

export const dynamic = "force-dynamic";

/** GET /api/attendance/month?year=2026&month=10 — periode 21 Sep s/d 20 Okt 2026, data milik user sendiri (via RLS). */
export async function GET(request: Request) {
  const profile = await getAuthenticatedProfile();
  if (!profile) return apiError("UNAUTHENTICATED", "Anda harus login.", 401);

  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));
  if (!isValidYearMonth(year, month)) {
    return apiError("VALIDATION_ERROR", "Parameter year/month tidak valid.", 422);
  }

  // Periode pembukuan: tgl 21 bulan sebelumnya s/d tgl 20 bulan `month`.
  const { start, end } = getPeriod(year, month);
  const supabase = getServerClient();

  const baseCols = "work_date, status, check_in_at, check_out_at, net_work_minutes, overtime_minutes";
  const loadRecs = async (cols: string) =>
    supabase.from("attendance_records").select(cols)
      .eq("user_id", profile.id).gte("work_date", start).lte("work_date", end);
  let recsRes = await loadRecs(`${baseCols}, shift`);
  // Migrasi 005 belum dijalankan: tetap tampilkan riwayat tanpa kolom shift.
  if (recsRes.error && isMissingColumn(recsRes.error)) recsRes = await loadRecs(baseCols);

  const [recs, hols, leaves] = await Promise.all([
    Promise.resolve(recsRes),
    supabase.from("holidays").select("holiday_date").gte("holiday_date", start).lte("holiday_date", end),
    supabase.from("leave_requests").select("leave_date, leave_type")
      .eq("user_id", profile.id).eq("status", "APPROVED").gte("leave_date", start).lte("leave_date", end),
  ]);

  if (recs.error || hols.error || leaves.error) {
    return apiError("DB_ERROR", "Gagal mengambil rekap bulanan.", 500);
  }

  const result = buildMonth({
    year,
    month,
    records: (recs.data ?? []) as never,
    holidays: (hols.data ?? []).map((h) => h.holiday_date as string),
    approvedLeaves: (leaves.data ?? []) as never,
  });
  return apiSuccess({ ...result, period: { start, end } });
}
