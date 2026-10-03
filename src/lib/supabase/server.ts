import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cache } from "react";

export interface Profile {
  id: string;
  full_name: string;
  role: "admin" | "employee";
  is_active: boolean;
  employee_code: string | null;
}

/**
 * Client terikat sesi user (cookies). Tunduk pada RLS.
 * Dipakai untuk SELECT/INSERT milik user sendiri.
 */
export function getServerClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Dipanggil dari Server Component (read-only cookies) — aman diabaikan,
            // middleware yang menyegarkan sesi.
          }
        },
        remove(name: string, options) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            /* sama seperti di atas */
          }
        },
      },
    }
  );
}

/**
 * Client service-role: MELEWATI RLS. Hanya untuk Route Handler / Server
 * Component. Jangan pernah mengimpornya dari kode "use client".
 */
export function getServiceRoleClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY belum diset di environment.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** User login + profil dari DB (bukan dari klaim JWT). Null jika tidak login/nonaktif. */
export const getAuthenticatedProfile = cache(async function getAuthenticatedProfile(): Promise<Profile | null> {
  const supabase = getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active, employee_code")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile || !profile.is_active) return null;
  return profile as Profile;
});

/** Sama seperti di atas, tetapi hanya mengembalikan profil jika role admin. */
export async function getAdminProfile(): Promise<Profile | null> {
  const profile = await getAuthenticatedProfile();
  return profile && profile.role === "admin" ? profile : null;
}
