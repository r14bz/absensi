export const dynamic = "force-dynamic";

/** Cek konfigurasi tanpa membocorkan nilai apa pun (hanya true/false). */
export async function GET() {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };
  const ok = Object.values(env).every(Boolean);
  return Response.json({ ok, env }, { status: ok ? 200 : 503 });
}
