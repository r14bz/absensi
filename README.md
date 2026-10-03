# Absensi Karyawan

Next.js 14 (App Router) + Supabase + Tailwind. Ringan (±88 kB JS awal), responsif untuk HP/tablet/desktop, bisa di-install sebagai PWA.

## Fitur
- Login email + password (akun dibuat admin)
- Karyawan: absen masuk/pulang (jam & tanggal dari server, zona waktu Asia/Jakarta), riwayat bulanan + rekap, pengajuan izin/sakit
- Admin: rekap harian semua karyawan, koreksi absensi (masuk audit log), persetujuan izin (otomatis tercatat di absensi), kelola akun karyawan
- Lembur dihitung per jam penuh (dibulatkan ke bawah), sesuai unit test

## 1. Setup Supabase
1. Buat project di https://supabase.com (pilih region Singapore agar dekat dengan Vercel `sin1`).
2. Buka **SQL Editor**, jalankan berurutan isi file:
   `supabase/migrations/001_initial_schema.sql` → `002_rls.sql` → `003_functions.sql` → `004_hardening_and_triggers.sql`
3. Authentication → Providers: pastikan **Email** aktif. Matikan pendaftaran mandiri ("Allow new users to sign up") agar hanya admin yang bisa membuat akun.
4. Settings → API: salin **Project URL**, **anon key**, dan **service_role key**.

## 2. Jalankan lokal
```bash
npm install
cp .env.example .env.local      # isi nilai Supabase + SEED_ADMIN_*
npm run create-admin            # membuat akun admin pertama
npm run dev                     # http://localhost:3000
```
Akses dari HP/PC lain di jaringan yang sama:
```bash
npm run dev:lan                 # lalu buka http://<IP-komputer>:3000
```
Cek konfigurasi: buka `/api/health` (semua nilai harus `true`).

## 3. Deploy ke Vercel
1. Push folder ini ke GitHub, lalu **Import** di Vercel (Framework: Next.js, otomatis).
2. Isi Environment Variables (Production + Preview):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_TIMEZONE=Asia/Jakarta`
3. Deploy. Buat admin pertama dari komputer Anda dengan `npm run create-admin` (memakai `.env.local` yang menunjuk ke Supabase produksi).
4. Buka `https://domain-anda/api/health` untuk memastikan konfigurasi lengkap.

> `SUPABASE_SERVICE_ROLE_KEY` bersifat rahasia: jangan beri awalan `NEXT_PUBLIC_` dan jangan di-commit.

## Penyebab 404 sebelumnya
Project awal tidak punya `src/app/page.tsx` (halaman `/`), `layout.tsx`, maupun halaman `/login`, sehingga membuka alamat utama (mis. `http://192.168.x.x:3000`) selalu 404. Sekarang `/` mengarahkan ke `/login` atau ke dashboard sesuai role.

## Perbaikan logika & keamanan (ringkas)
- Profil dibuat otomatis saat user baru terdaftar (trigger) — tanpa ini semua API menolak user baru.
- Celah RLS ditutup: karyawan tidak bisa lagi mengubah `role`/`is_active` sendiri, dan tidak bisa menyetujui izinnya sendiri.
- Rekap bulanan menghitung "tidak hadir" dari kalender (sebelumnya selalu 0 karena hari absen tak punya baris DB).
- Check-out memakai guard `check_out_at is null` agar dua klik bersamaan tidak saling menimpa; check-in diblok pada hari izin/sakit yang disetujui.
- Jam istirahat mengikuti tabel `work_settings`.
- Jam berjalan tidak lagi menyebabkan hydration mismatch.
- Dependency dipangkas (tanpa date-fns, simplewebauthn, playwright, clsx, tailwind-merge, lucide); Next.js dinaikkan ke 14.2.35.

## Perintah
`npm run build` · `npm test` · `npm run lint` · `npm run typecheck`

## Belum termasuk
Selfie + Supabase Storage, WebAuthn/biometrik, dan E2E test belum dibuat (skema database untuk selfie/biometrik sudah tersedia). Kamera, geolokasi, dan install PWA di HP mensyaratkan **HTTPS** (otomatis di Vercel; lewat IP LAN `http://` tidak didukung browser).
# absensi
