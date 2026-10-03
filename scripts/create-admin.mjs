// Membuat (atau mempromosikan) akun admin pertama.
// Jalankan: npm run create-admin   (membaca .env.local)
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.SEED_ADMIN_EMAIL;
const password = process.env.SEED_ADMIN_PASSWORD;
const name = process.env.SEED_ADMIN_NAME || "Administrator";

if (!url || !key || !email || !password) {
  console.error("Isi NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD di .env.local");
  process.exit(1);
}
if (password.length < 8 || password === "ganti-dengan-password-kuat") {
  console.error("SEED_ADMIN_PASSWORD harus diganti dan minimal 8 karakter.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

let userId;
const { data: created, error } = await supabase.auth.admin.createUser({
  email, password, email_confirm: true, user_metadata: { full_name: name },
});

if (error) {
  if (!/already|registered/i.test(error.message)) {
    console.error("Gagal membuat user:", error.message);
    process.exit(1);
  }
  // User sudah ada -> cari id-nya lalu promosikan jadi admin.
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listErr) { console.error(listErr.message); process.exit(1); }
  userId = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
  if (!userId) { console.error("User sudah ada tapi tidak ditemukan."); process.exit(1); }
} else {
  userId = created.user.id;
}

const { error: upErr } = await supabase.from("profiles").upsert({
  id: userId, full_name: name, email, role: "admin", is_active: true,
});
if (upErr) {
  console.error("Gagal menyimpan profil (sudah menjalankan migration 001-004?):", upErr.message);
  process.exit(1);
}
console.log(`Admin siap: ${email}`);
