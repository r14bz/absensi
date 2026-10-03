import { getAdminProfile, getServiceRoleClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/validation/attendance";
import { formatLocalTime, pad2 } from "@/lib/timezone";
import { buildMonth } from "@/lib/server/month";
import { formatPeriodRange, getPeriod, isValidYearMonth, periodName } from "@/lib/attendance/period";
import { formatMinutesAsHoursLabel } from "@/lib/attendance/calculations";
import { SHIFT_LABEL, type Shift } from "@/lib/types";
import { isMissingColumn } from "@/lib/server/db-errors";
import ExcelJS from "exceljs";

export const dynamic = "force-dynamic";

const PAGE = 1000; // batas default baris per request Supabase

/** Ambil SEMUA baris (Supabase memotong diam-diam di 1000 baris per request). */
async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<{ rows: T[]; failed: boolean; missingColumn?: boolean }> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) return { rows: [], failed: true, missingColumn: isMissingColumn(error) };
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return { rows, failed: false };
}

type Rec = {
  user_id: string;
  work_date: string;
  status: "PRESENT";
  check_in_at: string | null;
  check_out_at: string | null;
  net_work_minutes: number;
  overtime_minutes: number;
  notes: string | null;
  shift: Shift | null;
};
type Leave = { user_id: string; leave_date: string; leave_type: "SICK" | "PERMISSION" | "ANNUAL_LEAVE" | "OTHER" };

const STATUS_TEXT: Record<string, string> = {
  PRESENT: "HADIR",
  HOLIDAY: "LIBUR NASIONAL",
  DAY_OFF: "LIBUR MINGGU",
  SICK: "SAKIT",
  PERMISSION: "IZIN",
  ABSENT: "TIDAK HADIR",
};

/**
 * GET /api/admin/attendance/export?year=2026&month=10
 * Export rekap PERIODE pembukuan (21 bulan sebelumnya s/d 20 bulan `month`)
 * semua karyawan ke Excel (.xlsx).
 */
export async function GET(request: Request) {
  const admin = await getAdminProfile();
  if (!admin) return apiError("FORBIDDEN", "Akses khusus admin.", 403);

  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));
  if (!isValidYearMonth(year, month)) {
    return apiError("VALIDATION_ERROR", "Parameter year/month tidak valid.", 422);
  }

  const period = getPeriod(year, month);
  const periodTitle = `${periodName(year, month)} (${formatPeriodRange(period)})`;
  const supabase = getServiceRoleClient();

  // Semua query independen -> jalankan paralel.
  const recCols = "user_id, work_date, status, check_in_at, check_out_at, net_work_minutes, overtime_minutes, notes";
  const loadRecs = (cols: string) =>
    fetchAll<Rec>((from, to) =>
      supabase
        .from("attendance_records")
        .select(cols)
        .gte("work_date", period.start)
        .lte("work_date", period.end)
        .order("work_date")
        .order("user_id")
        .range(from, to) as never
    );

  const [empsRes, holsRes, leavesRes, recsFirst] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, employee_code, position, department")
      .eq("role", "employee")
      .eq("is_active", true)
      .order("full_name"),
    supabase.from("holidays").select("holiday_date").gte("holiday_date", period.start).lte("holiday_date", period.end),
    fetchAll<Leave>((from, to) =>
      supabase
        .from("leave_requests")
        .select("user_id, leave_date, leave_type")
        .eq("status", "APPROVED")
        .gte("leave_date", period.start)
        .lte("leave_date", period.end)
        .order("leave_date")
        .range(from, to) as never
    ),
    loadRecs(`${recCols}, shift`),
  ]);

  // Migrasi 005 belum dijalankan: export tetap jalan, kolom shift kosong.
  const recsRes = recsFirst.failed && recsFirst.missingColumn ? await loadRecs(recCols) : recsFirst;

  if (empsRes.error) return apiError("DB_ERROR", "Gagal memuat data karyawan.", 500);
  if (holsRes.error) return apiError("DB_ERROR", "Gagal memuat data libur.", 500);
  if (leavesRes.failed) return apiError("DB_ERROR", "Gagal memuat data cuti.", 500);
  if (recsRes.failed) return apiError("DB_ERROR", "Gagal memuat data absensi.", 500);

  const employees = empsRes.data ?? [];
  const holidays = (holsRes.data ?? []).map((h) => h.holiday_date as string);

  const recsByUser = new Map<string, Rec[]>();
  for (const r of recsRes.rows) {
    const list = recsByUser.get(r.user_id);
    if (list) list.push(r);
    else recsByUser.set(r.user_id, [r]);
  }
  const leavesByUser = new Map<string, Leave[]>();
  for (const l of leavesRes.rows) {
    const list = leavesByUser.get(l.user_id);
    if (list) list.push(l);
    else leavesByUser.set(l.user_id, [l]);
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Absensi App";
  workbook.created = new Date();

  const BRAND = "0B8A6B";
  const border = {
    top: { style: "thin" as const },
    left: { style: "thin" as const },
    bottom: { style: "thin" as const },
    right: { style: "thin" as const },
  };
  const styleHeader = (row: ExcelJS.Row) => {
    row.font = { bold: true, color: { argb: "FFFFFF" } };
    row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
    row.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    row.height = 28;
  };

  // ===== Sheet 1: Ringkasan Periode =====
  const summarySheet = workbook.addWorksheet("Ringkasan Bulanan");
  const SUMMARY_COLS = 14;
  summarySheet.mergeCells(1, 1, 1, SUMMARY_COLS);
  const t1 = summarySheet.getCell(1, 1);
  t1.value = `Rekap Absensi Periode ${periodTitle}`;
  t1.font = { bold: true, size: 16, color: { argb: BRAND } };
  t1.alignment = { horizontal: "center" };

  summarySheet.mergeCells(2, 1, 2, SUMMARY_COLS);
  const t2 = summarySheet.getCell(2, 1);
  t2.value = `Dicetak: ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`;
  t2.alignment = { horizontal: "center" };
  t2.font = { size: 10, color: { argb: "666666" } };

  styleHeader(
    summarySheet.addRow([
      "Kode Karyawan", "Nama", "Posisi", "Departemen",
      "Hadir", "Tidak Hadir", "Izin", "Sakit", "Libur",
      "Shift Pagi", "Shift Sore", "Shift Malam",
      "Total Jam Kerja", "Total Jam Lembur",
    ])
  );

  const monthByUser = new Map<string, ReturnType<typeof buildMonth>>();
  for (const emp of employees) {
    const m = buildMonth({
      year,
      month,
      records: recsByUser.get(emp.id) ?? [],
      holidays,
      approvedLeaves: leavesByUser.get(emp.id) ?? [],
    });
    monthByUser.set(emp.id, m);
    const { summary } = m;
    summarySheet.addRow([
      emp.employee_code ?? "-",
      emp.full_name,
      emp.position ?? "-",
      emp.department ?? "-",
      summary.presentDays,
      summary.absentDays,
      summary.permissionDays,
      summary.sickDays,
      summary.holidayDays,
      summary.shiftDays.PAGI,
      summary.shiftDays.SORE,
      summary.shiftDays.MALAM,
      formatMinutesAsHoursLabel(summary.totalNetMinutes),
      formatMinutesAsHoursLabel(summary.totalOvertimeMinutes),
    ]);
  }

  [15, 25, 20, 20, 9, 12, 8, 8, 8, 11, 11, 12, 16, 16].forEach((w, i) => {
    summarySheet.getColumn(i + 1).width = w;
  });
  for (let r = 3; r <= summarySheet.rowCount; r++) {
    const row = summarySheet.getRow(r);
    row.eachCell((cell) => {
      cell.border = border;
      if (r > 3) cell.alignment = { horizontal: "center", vertical: "middle" };
    });
    if (r > 3) row.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
  }
  summarySheet.views = [{ state: "frozen", ySplit: 3 }];

  // ===== Sheet 2: Detail Harian =====
  const detailSheet = workbook.addWorksheet("Detail Harian");
  const DETAIL_COLS = 10;
  detailSheet.mergeCells(1, 1, 1, DETAIL_COLS);
  const d1 = detailSheet.getCell(1, 1);
  d1.value = `Detail Absensi Harian Periode ${periodTitle}`;
  d1.font = { bold: true, size: 16, color: { argb: BRAND } };
  d1.alignment = { horizontal: "center" };

  styleHeader(
    detailSheet.addRow([
      "Tanggal", "Kode Karyawan", "Nama", "Shift", "Masuk", "Pulang", "Jam Kerja", "Lembur", "Status", "Catatan",
    ])
  );

  for (const emp of employees) {
    const recByDate = new Map((recsByUser.get(emp.id) ?? []).map((r) => [r.work_date, r]));
    const { days } = monthByUser.get(emp.id)!;
    for (const day of days) {
      const rec = recByDate.get(day.date);
      detailSheet.addRow([
        day.date,
        emp.employee_code ?? "-",
        emp.full_name,
        day.shift ? SHIFT_LABEL[day.shift] : "-",
        day.check_in_at ? formatLocalTime(day.check_in_at) : "-",
        day.check_out_at ? formatLocalTime(day.check_out_at) : "-",
        day.net_work_minutes ? formatMinutesAsHoursLabel(day.net_work_minutes) : "-",
        day.overtime_minutes ? formatMinutesAsHoursLabel(day.overtime_minutes) : "-",
        day.status ? STATUS_TEXT[day.status] ?? "-" : "-",
        rec?.notes ?? "-",
      ]);
    }
  }

  [12, 15, 25, 9, 9, 9, 12, 12, 18, 30].forEach((w, i) => {
    detailSheet.getColumn(i + 1).width = w;
  });
  for (let r = 2; r <= detailSheet.rowCount; r++) {
    const row = detailSheet.getRow(r);
    row.eachCell((cell) => {
      cell.border = border;
      if (r > 2) cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    });
    if (r > 2) {
      row.getCell(3).alignment = { horizontal: "left", vertical: "middle", wrapText: true };
      row.getCell(10).alignment = { horizontal: "left", vertical: "middle", wrapText: true };
    }
  }
  detailSheet.views = [{ state: "frozen", ySplit: 2 }];
  detailSheet.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: DETAIL_COLS } };

  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="rekap-absensi-periode-${year}-${pad2(month)}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
