"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { formatMinutesAsHoursLabel } from "@/lib/attendance/calculations";
import { formatLocalTime, getWorkDateInTimezone } from "@/lib/timezone";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SHIFTS, SHIFT_LABEL, type Shift, type Status } from "@/lib/types";
import { formatPeriodRange, getPeriod, getPeriodForDate } from "@/lib/attendance/period";

interface Row {
  user_id: string; full_name: string; employee_code: string | null; status: Status | null;
  check_in_at: string | null; check_out_at: string | null; net_work_minutes: number;
  overtime_minutes: number; break_minutes: number; notes: string | null; shift: Shift | null;
}

export default function AdminDailyPage() {
  const [date, setDate] = useState(getWorkDateInTimezone());
  const [rows, setRows] = useState<Row[]>([]);
  const [holiday, setHoliday] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  // Default = periode berjalan (21 s/d 20), dinamai menurut bulan akhir periode.
  const [exportYear, setExportYear] = useState(() => getPeriodForDate(getWorkDateInTimezone()).year);
  const [exportMonth, setExportMonth] = useState(() => getPeriodForDate(getWorkDateInTimezone()).month);
  const exportPeriod = getPeriod(exportYear, exportMonth);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const res = await api<{ rows: Row[]; holiday: string | null }>(`/api/admin/attendance?date=${date}`);
    if (!res.success || !res.data) setError(res.error?.message ?? "Gagal memuat rekap.");
    else { setRows(res.data.rows); setHoliday(res.data.holiday); }
    setLoading(false);
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const count = (s: Status) => rows.filter((r) => r.status === s).length;

  async function handleExport() {
    setExportLoading(true);
    try {
      const res = await fetch(`/api/admin/attendance/export?year=${exportYear}&month=${exportMonth}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message ?? "Gagal export");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rekap-absensi-periode-${exportYear}-${String(exportMonth).padStart(2, "0")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal export ke Excel");
    } finally {
      setExportLoading(false);
    }
  }

  return (
    <main className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-xl font-semibold">Rekap harian</h1>
        <div>
          <label htmlFor="date" className="label">Tanggal</label>
          <input id="date" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="input" />
        </div>
      </div>

      {/* Export Section */}
      <div className="card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Export Rekap Periode ke Excel</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="export-year" className="label">Tahun</label>
            <select id="export-year" value={exportYear} onChange={(e) => setExportYear(Number(e.target.value))} className="input">
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="export-month" className="label">Periode (bulan akhir)</label>
            <select id="export-month" value={exportMonth} onChange={(e) => setExportMonth(Number(e.target.value))} className="input">
              {[
                "Januari", "Februari", "Maret", "April", "Mei", "Juni",
                "Juli", "Agustus", "September", "Oktober", "November", "Desember"
              ].map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={exportLoading}
            className="btn-primary min-h-[44px]"
          >
            {exportLoading ? "Mengekspor..." : "Export ke Excel"}
          </button>
        </div>
        {/* eslint-disable react/no-unescaped-entities */}
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Periode {formatPeriodRange(exportPeriod)} (tgl 21 s/d tgl 20). File berisi 2 sheet: "Ringkasan Bulanan" (total per karyawan, termasuk jumlah hari per shift) & "Detail Harian" (per hari per karyawan, lengkap dengan shift).
        </p>
        {/* eslint-enable react/no-unescaped-entities */}
      </div>

      {holiday && <div className="alert-ok">Hari libur: {holiday}</div>}
      {error && <div role="alert" className="alert-error">{error}</div>}

      <dl className="grid grid-cols-4 gap-2 text-center text-sm">
        {([["Hadir", count("PRESENT")], ["Tidak hadir", count("ABSENT")], ["Izin", count("PERMISSION")], ["Sakit", count("SICK")]] as const).map(([k, v]) => (
          <div key={k} className="card !p-3"><dt className="text-xs text-gray-500 dark:text-gray-400">{k}</dt><dd className="text-lg font-semibold">{v}</dd></div>
        ))}
      </dl>

      <div className="card overflow-x-auto !p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
            <tr>
              <th className="px-4 py-3 font-medium">Karyawan</th>
              <th className="px-2 py-3 font-medium">Shift</th>
              <th className="px-2 py-3 font-medium">Masuk</th>
              <th className="px-2 py-3 font-medium">Pulang</th>
              <th className="px-2 py-3 font-medium">Kerja</th>
              <th className="px-2 py-3 font-medium">Lembur</th>
              <th className="px-2 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-500">Memuat...</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-500">Belum ada karyawan aktif.</td></tr>}
            {!loading && rows.map((r) => (
              <tr key={r.user_id} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                <td className="whitespace-nowrap px-4 py-3 font-medium">{r.full_name}</td>
                <td className="px-2 py-3">{r.shift ? SHIFT_LABEL[r.shift] : "\u2014"}</td>
                <td className="px-2 py-3 tabular-nums">{formatLocalTime(r.check_in_at)}</td>
                <td className="px-2 py-3 tabular-nums">{formatLocalTime(r.check_out_at)}</td>
                <td className="px-2 py-3 tabular-nums">{r.check_out_at ? formatMinutesAsHoursLabel(r.net_work_minutes) : "\u2014"}</td>
                <td className="px-2 py-3 tabular-nums">{r.check_out_at ? `${Math.floor(r.overtime_minutes / 60)}j` : "\u2014"}</td>
                <td className="px-2 py-3"><StatusBadge status={r.status} /></td>
                <td className="px-4 py-3 text-right">
                  <button type="button" className="btn-ghost !min-h-[36px] !px-3" onClick={() => setEditing(r)}>Koreksi</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <CorrectionDialog row={editing} date={date} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      )}
    </main>
  );
}

function CorrectionDialog({ row, date, onClose, onSaved }: { row: Row; date: string; onClose: () => void; onSaved: () => void }) {
  const [inTime, setInTime] = useState(row.check_in_at ? formatLocalTime(row.check_in_at) : "");
  const [outTime, setOutTime] = useState(row.check_out_at ? formatLocalTime(row.check_out_at) : "");
  const [brk, setBrk] = useState(String(row.break_minutes));
  const [notes, setNotes] = useState(row.notes ?? "");
  const [shiftVal, setShiftVal] = useState<Shift | "">(row.shift ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    const res = await api("/api/admin/attendance", {
      method: "POST",
      body: JSON.stringify({
        userId: row.user_id,
        workDate: date,
        checkInTime: inTime || null,
        checkOutTime: outTime || null,
        breakMinutes: Number(brk) || 0,
        notes: notes || undefined,
        shift: shiftVal || null,
      }),
    });
    if (!res.success) { setError(res.error?.message ?? "Gagal menyimpan."); setSaving(false); }
    else onSaved();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={"Koreksi absensi " + row.full_name}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <form onSubmit={save} className="card w-full max-w-md space-y-4 rounded-b-none sm:rounded-b-2xl">
        <h2 className="text-lg font-semibold">Koreksi: {row.full_name}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">{date} &middot; semua perubahan dicatat di audit log.</p>
        {error && <div role="alert" className="alert-error">{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="ci">Jam masuk</label><input id="ci" type="time" className="input" value={inTime} onChange={(e) => setInTime(e.target.value)} /></div>
          <div><label className="label" htmlFor="co">Jam pulang</label><input id="co" type="time" className="input" value={outTime} onChange={(e) => setOutTime(e.target.value)} /></div>
        </div>
        <div>
          <label className="label" htmlFor="sh">Shift</label>
          <select id="sh" className="input" value={shiftVal} onChange={(e) => setShiftVal(e.target.value as Shift | "")}>
            <option value="">— tidak diatur —</option>
            {SHIFTS.map((sh) => <option key={sh} value={sh}>{SHIFT_LABEL[sh]}</option>)}
          </select>
        </div>
        <div><label className="label" htmlFor="br">Istirahat (menit)</label><input id="br" type="number" min={0} max={600} inputMode="numeric" className="input" value={brk} onChange={(e) => setBrk(e.target.value)} /></div>
        <div><label className="label" htmlFor="nt">Catatan</label><input id="nt" maxLength={1000} className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <div className="flex gap-2">
          <button type="button" className="btn-ghost flex-1" onClick={onClose}>Batal</button>
          <button type="submit" className="btn-primary flex-1" disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</button>
        </div>
      </form>
    </div>
  );
}
