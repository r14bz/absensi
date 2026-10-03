import { redirect } from "next/navigation";
import { getAuthenticatedProfile } from "@/lib/supabase/server";
import { AppShell } from "@/components/ui/AppShell";

export const dynamic = "force-dynamic";

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const profile = await getAuthenticatedProfile();
  if (!profile) redirect("/login");

  return (
    <AppShell
      name={profile.full_name}
      nav={[
        { href: "/dashboard", label: "Absen" },
        { href: "/attendance", label: "Riwayat" },
        { href: "/leave", label: "Izin / Sakit" },
      ]}
      extra={profile.role === "admin" ? { href: "/admin", label: "Admin" } : undefined}
    >
      {children}
    </AppShell>
  );
}
