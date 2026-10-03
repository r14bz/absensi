"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { LEAVE_LABEL, type LeaveRequest } from "@/lib/types";

type Item = LeaveRequest & { full_name: string };
const STATUS_TEXT = { PENDING: "Menunggu", APPROVED: "Disetujui", REJECTED: "Ditolak" } as const;

export default function AdminLeavesPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api<{ requests: Item[] }>("/api/admin/leaves");
    if (res.success && res.data) setItems(res.data.requests);
    else setError(res.error?.message ?? "Gagal memuat.");
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function decide(id: string, decision: "APPROVED" | "REJECTED") {
    setBusy(id); setError(null);
    const res = await api("/api/admin/leaves", { method: "PATCH", body: JSON.stringify({ id, decision }) });
    if (!res.success) setError(res.error?.message ?? "Gagal menyimpan keputusan.");
    await load();
    setBusy(null);
  }

  return (
    <main className="space-y-4">
      <h1 className="text-xl font-semibold">Pengajuan izin / sakit</h1>
      {error && <div role="alert" className="alert-error">{error}</div>}
      {loading ? <p className="text-sm text-gray-500">Memuat...</p> : items.length === 0 ? (
        <p className="text-sm text-gray-500">Belum ada pengajuan.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((r) => (
            <li key={r.id} className="card !p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{r.full_name}</p>
                <span className="text-sm text-gray-600 dark:text-gray-400">{STATUS_TEXT[r.status]}</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{r.leave_date} · {LEAVE_LABEL[r.leave_type]}</p>
              {r.reason && <p className="mt-1 text-sm">{r.reason}</p>}
              {r.status === "PENDING" && (
                <div className="mt-3 flex gap-2">
                  <button type="button" disabled={busy === r.id} className="btn-primary flex-1" onClick={() => decide(r.id, "APPROVED")}>Setujui</button>
                  <button type="button" disabled={busy === r.id} className="btn-ghost flex-1" onClick={() => decide(r.id, "REJECTED")}>Tolak</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
