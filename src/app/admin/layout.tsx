import { redirect } from "next/navigation";
import { getAuthenticatedProfile } from "@/lib/supabase/server";
import { AppShell } from "@/components/ui/AppShell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getAuthenticatedProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/dashboard");

  return (
    <AppShell
      name={profile.full_name}
      nav={[
        { href: "/admin", label: "Rekap harian" },
        { href: "/admin/leaves", label: "Izin" },
        { href: "/admin/employees", label: "Karyawan" },
      ]}
      extra={{ href: "/dashboard", label: "Absen saya" }}
    >
      {children}
    </AppShell>
  );
}
