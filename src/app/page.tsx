import { redirect } from "next/navigation";
import { getAuthenticatedProfile } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** "/" tidak lagi 404: arahkan sesuai status login & role. */
export default async function Home() {
  const profile = await getAuthenticatedProfile();
  if (!profile) redirect("/login");
  redirect(profile.role === "admin" ? "/admin" : "/dashboard");
}
