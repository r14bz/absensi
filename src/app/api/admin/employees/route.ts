import { getAdminProfile, getServiceRoleClient } from "@/lib/supabase/server";
import { createEmployeeSchema, updateEmployeeSchema, apiError, apiSuccess } from "@/lib/validation/attendance";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getAdminProfile();
  if (!admin) return apiError("FORBIDDEN", "Akses khusus admin.", 403);

  const { data, error } = await getServiceRoleClient()
    .from("profiles")
    .select("id, full_name, email, employee_code, position, department, role, is_active")
    .order("full_name");
  if (error) return apiError("DB_ERROR", "Gagal memuat karyawan.", 500);
  return apiSuccess({ employees: data ?? [], me: admin.id });
}

/** Membuat akun login + profil karyawan (email langsung terverifikasi). */
export async function POST(request: Request) {
  const admin = await getAdminProfile();
  if (!admin) return apiError("FORBIDDEN", "Akses khusus admin.", 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("INVALID_JSON", "Body request tidak valid.", 400);
  }
  const parsed = createEmployeeSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.issues.map((i) => i.message).join("; "), 422);
  }
  const input = parsed.data;
  const supabase = getServiceRoleClient();

  const { data: created, error: authError } = await supabase.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.fullName },
  });
  if (authError || !created.user) {
    const exists = authError?.message?.toLowerCase().includes("already");
    return apiError(exists ? "EMAIL_TAKEN" : "AUTH_ERROR", exists ? "Email sudah terdaftar." : "Gagal membuat akun.", exists ? 409 : 500);
  }

  // Profil dibuat oleh trigger handle_new_user; di sini dilengkapi (upsert agar aman bila trigger belum terpasang).
  const { error: profileError } = await supabase.from("profiles").upsert({
    id: created.user.id,
    full_name: input.fullName,
    email: input.email,
    employee_code: input.employeeCode || null,
    position: input.position || null,
    department: input.department || null,
    role: input.role,
    is_active: true,
  });
  if (profileError) {
    await supabase.auth.admin.deleteUser(created.user.id);
    const dupCode = profileError.code === "23505";
    return apiError(dupCode ? "CODE_TAKEN" : "DB_ERROR", dupCode ? "Kode karyawan sudah dipakai." : "Gagal menyimpan profil.", dupCode ? 409 : 500);
  }

  await supabase.from("audit_logs").insert({
    actor_user_id: admin.id,
    action: "EMPLOYEE_CREATED",
    entity_type: "profiles",
    entity_id: created.user.id,
    new_data: { email: input.email, role: input.role },
  });
  return apiSuccess({ id: created.user.id }, 201);
}

/** Aktifkan / nonaktifkan akun. Admin tidak boleh menonaktifkan dirinya sendiri. */
export async function PATCH(request: Request) {
  const admin = await getAdminProfile();
  if (!admin) return apiError("FORBIDDEN", "Akses khusus admin.", 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("INVALID_JSON", "Body request tidak valid.", 400);
  }
  const parsed = updateEmployeeSchema.safeParse(body);
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Data tidak valid.", 422);
  if (parsed.data.id === admin.id && !parsed.data.isActive) {
    return apiError("SELF_DEACTIVATE", "Anda tidak bisa menonaktifkan akun sendiri.", 409);
  }

  const supabase = getServiceRoleClient();
  const { error } = await supabase.from("profiles").update({ is_active: parsed.data.isActive }).eq("id", parsed.data.id);
  if (error) return apiError("DB_ERROR", "Gagal mengubah status akun.", 500);

  await supabase.from("audit_logs").insert({
    actor_user_id: admin.id,
    action: parsed.data.isActive ? "EMPLOYEE_ACTIVATED" : "EMPLOYEE_DEACTIVATED",
    entity_type: "profiles",
    entity_id: parsed.data.id,
  });
  return apiSuccess({ ok: true });
}
