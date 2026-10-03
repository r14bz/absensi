"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { getWorkDateInTimezone } from "@/lib/timezone";
import { LEAVE_LABEL, type LeaveRequest } from "@/lib/types";

const STATUS_TEXT = { PENDING: "Menunggu", APPROVED: "Disetujui", REJECTED: "Ditolak" } as const;
const STATUS_COLOR = {
  PENDING: "text-amber-700 dark:text-amber-300",
  APPROVED: "text-emerald-700 dark:text-emerald-300",
  REJECTED: "text-red-700 dark:text-red-300",
} as const;

export default function LeavePage() {
  const [items, setItems] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(getWorkDateInTimezone());
  const [type, setType] = useState<LeaveRequest["leave_type"]>("SICK");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api<{ requests: LeaveRequest[] }>("/api/leave");
    if (res.success && res.data) setItems(res.data.requests);
    else setError(res.error?.message ?? "Gagal memuat pengajuan.");
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null); setOk(null);
    const res = await api("/api/leave", {
      method: "POST",
      body: JSON.stringify({ leaveDate: date, leaveType: type, reason }),
    });
    if (!res.success) setError(res.error?.message ?? "Gagal mengirim.");
    else { setOk("Pengajuan terkirim, menunggu persetujuan admin."); setReason(""); await load(); }
    setSaving(false);
  }

  return (
    <main className="space-y-6">
      <h1 className="text-xl font-semibold">Izin / Sakit</h1>

      <form onSubmit={submit} className="card space-y-4">
        {error && <div role="alert" className="alert-error">{error}</div>}
        {ok && <div role="status" className="alert-ok">{ok}</div>}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="d" className="label">Tanggal</label>
            <input id="d" type="date" required min={getWorkDateInTimezone()} value={date}
              onChange={(e) => setDate(e.target.value)} className="input" />
          </div>
          <div>
            <label htmlFor="t" className="label">Jenis</label>
            <select id="t" value={type} onChange={(e) => setType(e.target.value as LeaveRequest["leave_type"])} className="input">
              {Object.entries(LEAVE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="r" className="label">Alasan</label>
          <textarea id="r" required minLength={3} maxLength={1000} rows={3} value={reason}
            onChange={(e) => setReason(e.target.value)} className="input" />
        </div>
        <button type="submit" disabled={saving || reason.trim().length < 3} className="btn-primary w-full sm:w-auto">
          {saving ? "Mengirim..." : "Kirim pengajuan"}
        </button>
      </form>

      <section aria-labelledby="riwayat">
        <h2 id="riwayat" className="mb-2 text-base font-semibold">Pengajuan saya</h2>
        {loading ? <p className="text-sm text-gray-500">Memuat...</p> : items.length === 0 ? (
          <p className="text-sm text-gray-500">Belum ada pengajuan.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((r) => (
              <li key={r.id} className="card !p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{r.leave_date} · {LEAVE_LABEL[r.leave_type]}</p>
                  <span className={`text-sm font-medium ${STATUS_COLOR[r.status]}`}>{STATUS_TEXT[r.status]}</span>
                </div>
                {r.reason && <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{r.reason}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
