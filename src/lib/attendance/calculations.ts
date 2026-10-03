/**
 * Semua fungsi di file ini HARUS pure (tidak ada side effect, tidak
 * ada akses DB/network) supaya mudah diuji dan supaya hasilnya
 * deterministik. Ini adalah satu-satunya "source of truth" untuk
 * perhitungan jam kerja & lembur — dipakai di server (API routes),
 * BUKAN dihitung ulang secara independen di frontend untuk keperluan
 * apa pun yang bersifat otoritatif (payroll, rekap resmi).
 */

export type AttendanceStatus =
  | "PRESENT"
  | "ABSENT"
  | "PERMISSION"
  | "SICK"
  | "HOLIDAY"
  | "DAY_OFF";

export interface WorkSettings {
  standardWorkMinutes: number; // default 480 (8 jam)
  breakMinutes: number; // default 60
  overtimeRoundingMinutes: number; // default 60
}

export const DEFAULT_WORK_SETTINGS: WorkSettings = {
  standardWorkMinutes: 480,
  breakMinutes: 60,
  overtimeRoundingMinutes: 60,
};

/**
 * Selisih menit antara dua instant. Melempar error jika checkOut
 * lebih awal dari checkIn (data tidak valid — jangan pernah
 * menghasilkan angka negatif secara diam-diam).
 */
export function calculateGrossWorkMinutes(
  checkInAt: Date,
  checkOutAt: Date
): number {
  const diffMs = checkOutAt.getTime() - checkInAt.getTime();
  if (diffMs < 0) {
    throw new Error(
      "INVALID_TIME_RANGE: check-out lebih awal dari check-in"
    );
  }
  return Math.floor(diffMs / 60000);
}

/**
 * Net = gross - break. Tidak boleh negatif (dibatasi ke 0) agar
 * shift yang lebih pendek dari waktu istirahat tidak menghasilkan
 * angka minus yang membingungkan di laporan.
 */
export function calculateNetWorkMinutes(
  grossWorkMinutes: number,
  breakMinutes: number
): number {
  return Math.max(0, grossWorkMinutes - breakMinutes);
}

/**
 * Lembur dihitung dari net_work_minutes yang melebihi standar,
 * lalu DIBULATKAN KE BAWAH per kelipatan overtimeRoundingMinutes.
 *
 * Contoh (standard=480, rounding=60):
 *   net=480 -> overtime_minutes=0
 *   net=509 -> raw=29  -> rounded=0
 *   net=510 -> raw=30  -> rounded=0   (belum genap 60)
 *   net=540 -> raw=60  -> rounded=60  (1 jam)
 *   net=599 -> raw=119 -> rounded=60  (1 jam)
 *   net=600 -> raw=120 -> rounded=120 (2 jam)
 */
export function calculateOvertimeMinutes(params: {
  netWorkMinutes: number;
  standardWorkMinutes: number;
  roundingMinutes: number;
}): number {
  const { netWorkMinutes, standardWorkMinutes, roundingMinutes } = params;
  const raw = Math.max(0, netWorkMinutes - standardWorkMinutes);
  const roundedUnits = Math.floor(raw / roundingMinutes);
  return roundedUnits * roundingMinutes;
}

export interface AttendanceCalculationResult {
  grossWorkMinutes: number;
  netWorkMinutes: number;
  overtimeMinutes: number;
  overtimeHours: number;
}

/**
 * Fungsi orkestrasi tunggal yang dipanggil dari API route saat
 * check-out. Menggabungkan ketiga langkah di atas.
 */
export function calculateAttendance(params: {
  checkInAt: Date;
  checkOutAt: Date;
  settings?: WorkSettings;
}): AttendanceCalculationResult {
  const settings = params.settings ?? DEFAULT_WORK_SETTINGS;

  const grossWorkMinutes = calculateGrossWorkMinutes(
    params.checkInAt,
    params.checkOutAt
  );
  const netWorkMinutes = calculateNetWorkMinutes(
    grossWorkMinutes,
    settings.breakMinutes
  );
  const overtimeMinutes = calculateOvertimeMinutes({
    netWorkMinutes,
    standardWorkMinutes: settings.standardWorkMinutes,
    roundingMinutes: settings.overtimeRoundingMinutes,
  });

  return {
    grossWorkMinutes,
    netWorkMinutes,
    overtimeMinutes,
    overtimeHours: Math.floor(overtimeMinutes / 60),
  };
}

/** Format menit menjadi "8j 08m" untuk tampilan UI. */
export function formatMinutesAsHoursLabel(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}j ${String(minutes).padStart(2, "0")}m`;
}

/**
 * Menentukan status hari berdasarkan business logic yang jelas
 * (bukan asumsi diam-diam bahwa "tidak absen" = libur).
 * Urutan prioritas: HOLIDAY > approved leave (SICK/PERMISSION) >
 * DAY_OFF (akhir pekan sesuai konfigurasi) > PRESENT (ada check-in) >
 * ABSENT (default, hari kerja tanpa aktivitas apa pun).
 */
export function resolveAttendanceStatus(params: {
  isHoliday: boolean;
  isConfiguredDayOff: boolean;
  approvedLeaveType: "SICK" | "PERMISSION" | "ANNUAL_LEAVE" | "OTHER" | null;
  hasCheckIn: boolean;
}): AttendanceStatus {
  if (params.isHoliday) return "HOLIDAY";
  if (params.approvedLeaveType === "SICK") return "SICK";
  if (params.approvedLeaveType) return "PERMISSION";
  if (params.isConfiguredDayOff) return "DAY_OFF";
  if (params.hasCheckIn) return "PRESENT";
  return "ABSENT";
}
