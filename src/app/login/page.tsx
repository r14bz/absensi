"use client";

import { useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import { api } from "@/lib/client/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = getBrowserClient();
      const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError) {
        setError("Email atau password salah.");
        return;
      }
      // Pastikan profil ada & aktif sebelum masuk.
      const me = await api<{ profile: { role: string } }>("/api/me");
      if (!me.success) {
        await supabase.auth.signOut();
        setError(me.error?.message ?? "Akun tidak dapat digunakan.");
        return;
      }
      window.location.assign("/");
    } catch {
      setError("Tidak dapat terhubung. Periksa koneksi lalu coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-10">
      <h1 className="text-2xl font-semibold">Masuk</h1>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Gunakan akun yang diberikan admin.</p>

      <form onSubmit={onSubmit} className="card mt-6 space-y-4" noValidate>
        {error && <div role="alert" className="alert-error">{error}</div>}
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" type="email" inputMode="email" autoComplete="username" required className="input"
            value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label htmlFor="password" className="label">Password</label>
          <input id="password" type="password" autoComplete="current-password" required className="input"
            value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button type="submit" disabled={loading || !email || !password} className="btn-primary w-full">
          {loading ? "Memproses..." : "Masuk"}
        </button>
      </form>
    </main>
  );
}
