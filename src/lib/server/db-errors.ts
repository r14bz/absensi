/** Kolom/tabel belum ada (migrasi belum dijalankan). Postgres 42703, PostgREST PGRST204/PGRST200. */
export function isMissingColumn(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return false;
  return e.code === "42703" || e.code === "PGRST204" || /column .*(shift)|shift.*(does not exist|schema cache)/i.test(e.message ?? "");
}

export const MIGRATION_HINT = "Database belum diperbarui: jalankan supabase/migrations/005_shift_period_storage.sql di Supabase SQL Editor.";
