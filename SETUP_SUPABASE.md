# Setup Supabase untuk Aplikasi Absensi

## 1. Buat Project Supabase Baru

1. Buka [supabase.com](https://supabase.com) dan login/daftar
2. Klik **"New Project"**
3. Isi:
   - **Name**: `absensi-app` (atau nama lain)
   - **Database Password**: buat password kuat (simpan!)
   - **Region**: pilih yang terdekat (Singapore untuk Asia)
4. Klik **"Create new project"** — tunggu 2-3 menit

## 2. Dapatkan Kredensial API

1. Di dashboard project, masuk ke **Settings** (ikon gear kiri bawah) → **API**
2. Salin nilai berikut:
   - **Project URL** → isi ke `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → isi ke `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** (secret) → isi ke `SUPABASE_SERVICE_ROLE_KEY`

⚠️ **Jangan bagikan `service_role_key` ke client/browser!**

## 3. Update File `.env.local`

Buka `C:\Users\enda\Desktop\absensi\.env.local` dan ganti placeholder dengan nilai asli:

```env
# ===== SUPABASE (public, aman di browser) =====
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ===== SUPABASE (SERVER ONLY — jangan pernah diberi awalan NEXT_PUBLIC_) =====
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ===== APP =====
NEXT_PUBLIC_TIMEZONE=Asia/Jakarta

# ===== Hanya dipakai script `npm run create-admin` =====
SEED_ADMIN_EMAIL=admin@perusahaan.com
SEED_ADMIN_PASSWORD=PasswordKuat123!
SEED_ADMIN_NAME=Administrator
```

## 4. Jalankan Migrasi Database

```bash
# Install Supabase CLI (jika belum)
npm i -g supabase

# Login ke Supabase
supabase login

# Link project lokal ke project cloud
supabase link --project-ref YOUR_PROJECT_REF

# Push migrasi
supabase db push
```

Atau jalankan SQL migrasi manual via **SQL Editor** di dashboard Supabase:
1. Buka `supabase/migrations/001_initial_schema.sql` → copy → paste → Run
2. Ulangi untuk `002_rls.sql`, `003_functions.sql`, `004_hardening_and_triggers.sql`

## 5. Buat Admin Pertama

```bash
npm run create-admin
```

Script ini akan:
- Buat user auth dengan email/password dari `.env.local`
- Masukkan profil ke tabel `profiles` dengan `role = 'admin'` dan `is_active = true`

## 6. Jalankan Development Server

```bash
npm run dev
```

Buka http://localhost:3000 → seharusnya redirect ke `/login` → login dengan akun admin yang baru dibuat.

## Troubleshooting Umum

| Masalah | Solusi |
|---------|--------|
| Halaman login tidak muncul / blank | Cek `.env.local` sudah diisi benar, restart `npm run dev` |
| Error "Konfigurasi belum lengkap" | Variabel env belum diset / salah format, cek `.env.local` |
| Login gagal "Email atau password salah" | Pastikan `npm run create-admin` sudah jalan, cek email/password di `.env.local` |
| Redirect loop / 404 | Cek middleware matcher, pastikan `/login` tidak terproteksi |
| Database error / RLS | Pastikan semua 4 file migrasi sudah dijalankan di Supabase |

## Catatan Penting

- **Restart server** (`npm run dev`) setelah mengubah `.env.local`
- `NEXT_PUBLIC_*` prefix berarti nilai **bisa dibaca browser** (aman untuk anon key)
- `SUPABASE_SERVICE_ROLE_KEY` **HANYA untuk server** — jangan tambahkan prefix `NEXT_PUBLIC_`
- Timezone default `Asia/Jakarta` — ubah di `.env.local` jika perlu

## Migrasi 005 (WAJIB dijalankan setelah update ini)

Jalankan `supabase/migrations/005_shift_period_storage.sql` di Supabase SQL Editor. Isinya:

1. Kolom `shift` (PAGI / SORE / MALAM) pada `attendance_records`.
2. Bucket Storage privat `attendance-selfies` + policy RLS (upload hanya ke folder `user_id/` milik sendiri; admin boleh melihat semua). Tanpa ini upload selfie selalu gagal.
3. Fungsi `monthly_attendance_summary` mengikuti periode pembukuan 21 s/d 20.

## Catatan penting kamera & GPS

- Kamera dan GPS **hanya berfungsi lewat HTTPS** (Vercel otomatis) atau `localhost`. Lewat `http://192.168.x.x` browser memblokirnya.
- Izin kamera sebelumnya diblokir oleh header `Permissions-Policy` di `next.config.mjs` (`camera=()`); sekarang `camera=(self)`.

## Periode pembukuan

Periode dinamai menurut bulan akhirnya: **Oktober 2026 = 21 Sep 2026 s/d 20 Okt 2026**. Logikanya ada di `src/lib/attendance/period.ts` (ubah `PERIOD_START_DAY` bila aturan berubah).
