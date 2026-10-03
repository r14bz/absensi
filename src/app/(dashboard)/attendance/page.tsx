"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { formatMinutesAsHoursLabel } from "@/lib/attendance/calculations";
import { formatLocalTime, getWorkDateInTimezone, pad2 } from "@/lib/timezone";
import { formatPeriodRange, getPeriodForDate, periodName, shiftPeriod } from "@/lib/attendance/period";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SHIFT_LABEL, type Shift, type Status } from "@/lib/types";

interface Day {
  date: string;
  status: Status | null;
  check_in_at: string | null;
  check_out_at: string | null;
  net_work_minutes: number;
  overtime_minutes: number;
  shift: Shift | null;
}
interface Summary {
  workDays: number; presentDays: number; absentDays: number; permissionDays: number;
  sickDays: number; holidayDays: number; totalNetMinutes: number; totalOvertimeMinutes: number;
}

const DOW = ["Min","Sen","Sel","Rab","Kam","Jum","Sab"];

export default function HistoryPage() {
  // Periode pembukuan: tgl 21 s/d tgl 20. Tgl >= 21 sudah masuk periode bulan berikutnya.
  const [{ year, month }, setPeriodState] = useState(() => {
    const p = getPeriodForDate(getWorkDateInTimezone());
    return { year: p.year, month: p.month };
  });
  const [range, setRange] = useState<{ start: string; end: string } | null>(null);
  const [days, setDays] = useState<Day[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api<{ days: Day[]; summary: Summary; period: { start: string; end: string } }>(`/api/attendance/month?year=${year}&month=${month}`);
    if (!res.success || !res.data) setError(res.error?.message ?? "Gagal memuat riwayat.");
    else { setDays(res.data.days); setSummary(res.data.summary); setRange(res.data.period); }
    setLoading(false);
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  function move(delta: number) {
    setPeriodState(shiftPeriod(year, month, delta));
  }

  const cells = days.filter((d) => d.status !== null);

  return (
    <main>
      <div className="flex items-center justify-between gap-2">
        <button type="button" className="btn-ghost" onClick={() => move(-1)} aria-label="Periode sebelumnya">‹</button>
        <div className="text-center">
          <h1 className="text-lg font-semibold">Periode {periodName(year, month)}</h1>
          {range && <p className="text-xs text-gray-500 dark:text-gray-400">{formatPeriodRange(range)}</p>}
        </div>
        <button type="button" className="btn-ghost" onClick={() => move(1)} aria-label="Periode berikutnya">›</button>
      </div>

      {error && <div role="alert" className="alert-error mt-4">{error}</div>}

      {summary && (
        <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-sm sm:grid-cols-4">
          {[
            ["Hadir", summary.presentDays],
            ["Tidak hadir", summary.absentDays],
            ["Izin", summary.permissionDays],
            ["Sakit", summary.sickDays],
            ["Libur", summary.holidayDays],
            ["Jam kerja", formatMinutesAsHoursLabel(summary.totalNetMinutes)],
            ["Lembur", `${Math.floor(summary.totalOvertimeMinutes / 60)} jam`],
          ].map(([k, v]) => (
            <div key={String(k)} className="card !p-3">
              <dt className="text-xs text-gray-500 dark:text-gray-400">{k}</dt>
              <dd className="mt-0.5 text-base font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="card mt-4 overflow-x-auto !p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
            <tr>
              <th className="px-4 py-3 font-medium">Tanggal</th>
              <th className="px-2 py-3 font-medium">Shift</th>
              <th className="px-2 py-3 font-medium">Masuk</th>
              <th className="px-2 py-3 font-medium">Pulang</th>
              <th className="px-2 py-3 font-medium">Jam kerja</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">Memuat...</td></tr>
            )}
            {!loading && cells.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">Belum ada data.</td></tr>
            )}
            {!loading && [...cells].reverse().map((d) => {
              const dt = new Date(`${d.date}T00:00:00Z`);
              return (
                <tr key={d.date} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                  <td className="whitespace-nowrap px-4 py-3">{DOW[dt.getUTCDay()]}, {pad2(dt.getUTCDate())}/{pad2(dt.getUTCMonth() + 1)}</td>
                  <td className="px-2 py-3">{d.shift ? SHIFT_LABEL[d.shift] : "—"}</td>
                  <td className="px-2 py-3 tabular-nums">{formatLocalTime(d.check_in_at)}</td>
                  <td className="px-2 py-3 tabular-nums">{formatLocalTime(d.check_out_at)}</td>
                  <td className="px-2 py-3 tabular-nums">{d.check_out_at ? formatMinutesAsHoursLabel(d.net_work_minutes) : "—"}</td>
                  <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
