import { createBrowserClient } from "@supabase/ssr";

/**
 * Client untuk komponen client-side. Hanya pernah memakai anon key
 * (aman untuk browser) — SUPABASE_SERVICE_ROLE_KEY tidak pernah
 * diimpor di file manapun di bawah src/app/**\/page.tsx atau
 * komponen "use client".
 */
export function getBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
