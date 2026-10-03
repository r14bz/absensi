"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client/api";

interface Emp {
  id: string; full_name: string; email: string | null; employee_code: string | null;
  position: string | null; department: string | null; role: "admin" | "employee"; is_active: boolean;
}

const EMPTY = { fullName: "", email: "", password: "", employeeCode: "", position: "", department: "", role: "employee" as "employee" | "admin" };

export default function AdminEmployeesPage() {
  const [emps, setEmps] = useState<Emp[]>([]);
  const [me, setMe] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api<{ employees: Emp[]; me: string }>("/api/admin/employees");
    if (res.success && res.data) { setEmps(res.data.employees); setMe(res.data.me); }
    else setError(res.error?.message ?? "Gagal memuat.");
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null); setOk(null);
    const res = await api("/api/admin/employees", { method: "POST", body: JSON.stringify(form) });
    if (!res.success) setError(res.error?.message ?? "Gagal membuat akun.");
    else { setOk(`Akun ${form.email} dibuat.`); setForm(EMPTY); await load(); }
    setSaving(false);
  }

  async function toggle(emp: Emp) {
    setError(null);
    const res = await api("/api/admin/employees", { method: "PATCH", body: JSON.stringify({ id: emp.id, isActive: !emp.is_active }) });
    if (!res.success) setError(res.error?.message ?? "Gagal mengubah status.");
    await load();
  }

  return (
    <main className="space-y-6">
      <h1 className="text-xl font-semibold">Karyawan</h1>

      <form onSubmit={create} className="card space-y-4">
        <h2 className="text-base font-semibold">Tambah akun</h2>
        {error && <div role="alert" className="alert-error">{error}</div>}
        {ok && <div role="status" className="alert-ok">{ok}</div>}
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="n">Nama lengkap</label><input id="n" required className="input" value={form.fullName} onChange={set("fullName")} /></div>
          <div><label className="label" htmlFor="e">Email</label><input id="e" type="email" required autoComplete="off" className="input" value={form.email} onChange={set("email")} /></div>
          <div><label className="label" htmlFor="p">Password awal (min. 8)</label><input id="p" type="password" required minLength={8} autoComplete="new-password" className="input" value={form.password} onChange={set("password")} /></div>
          <div><label className="label" htmlFor="c">Kode karyawan</label><input id="c" className="input" value={form.employeeCode} onChange={set("employeeCode")} /></div>
          <div><label className="label" htmlFor="po">Jabatan</label><input id="po" className="input" value={form.position} onChange={set("position")} /></div>
          <div><label className="label" htmlFor="de">Departemen</label><input id="de" className="input" value={form.department} onChange={set("department")} /></div>
          <div><label className="label" htmlFor="ro">Peran</label>
            <select id="ro" className="input" value={form.role} onChange={set("role")}><option value="employee">Karyawan</option><option value="admin">Admin</option></select>
          </div>
        </div>
        <button type="submit" disabled={saving} className="btn-primary w-full sm:w-auto">{saving ? "Menyimpan..." : "Buat akun"}</button>
      </form>

      <div className="card overflow-x-auto !p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
            <tr><th className="px-4 py-3 font-medium">Nama</th><th className="px-2 py-3 font-medium">Peran</th><th className="px-2 py-3 font-medium">Status</th><th className="px-4 py-3" /></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-500">Memuat...</td></tr>}
            {!loading && emps.map((x) => (
              <tr key={x.id} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                <td className="px-4 py-3"><p className="font-medium">{x.full_name}</p><p className="text-xs text-gray-500">{x.email}{x.employee_code ? ` · ${x.employee_code}` : ""}</p></td>
                <td className="px-2 py-3">{x.role === "admin" ? "Admin" : "Karyawan"}</td>
                <td className="px-2 py-3">{x.is_active ? "Aktif" : "Nonaktif"}</td>
                <td className="px-4 py-3 text-right">
                  <button type="button" disabled={x.id === me} className="btn-ghost !min-h-[36px] !px-3" onClick={() => toggle(x)}>
                    {x.is_active ? "Nonaktifkan" : "Aktifkan"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
