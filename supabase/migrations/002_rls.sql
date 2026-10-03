-- ============================================================
-- 002_rls.sql
-- Row Level Security. Prinsip: employee hanya boleh baca/tulis
-- data miliknya sendiri; admin ditentukan dari kolom role di
-- tabel profiles (bukan dari email/claim yang dikirim client).
-- ------------------------------------------------------------
-- Catatan penting: INSERT/UPDATE ke attendance_records dari sisi
-- employee TIDAK diizinkan langsung lewat RLS untuk mutasi utama
-- (check-in/check-out) — itu HARUS lewat Route Handler yang
-- memakai SUPABASE_SERVICE_ROLE_KEY di server, agar business
-- logic (idempotency, timezone, perhitungan jam) tidak bisa
-- dilewati oleh client. RLS di sini adalah lapisan pertahanan
-- kedua (defense in depth), bukan satu-satunya penjamin.
-- ============================================================

alter table profiles enable row level security;
alter table work_settings enable row level security;
alter table holidays enable row level security;
alter table attendance_records enable row level security;
alter table attendance_events enable row level security;
alter table leave_requests enable row level security;
alter table biometric_credentials enable row level security;
alter table audit_logs enable row level security;

-- Helper: is current user an admin? (SECURITY DEFINER agar tidak
-- terjadi recursive RLS check saat membaca profiles-nya sendiri)
create or replace function is_admin()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin' and is_active = true
  );
$$ language sql security definer stable;

-- ------------------------------------------------------------
-- profiles
-- ------------------------------------------------------------
create policy "profiles_select_own_or_admin"
  on profiles for select
  using (id = auth.uid() or is_admin());

create policy "profiles_update_own_limited"
  on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles_admin_manage"
  on profiles for all
  using (is_admin())
  with check (is_admin());

-- ------------------------------------------------------------
-- work_settings — semua authenticated user boleh baca (dibutuhkan
-- untuk menghitung jam kerja di UI), hanya admin boleh ubah.
-- ------------------------------------------------------------
create policy "work_settings_select_authenticated"
  on work_settings for select
  using (auth.uid() is not null);

create policy "work_settings_admin_write"
  on work_settings for all
  using (is_admin())
  with check (is_admin());

-- ------------------------------------------------------------
-- holidays — semua authenticated user boleh baca, admin kelola.
-- ------------------------------------------------------------
create policy "holidays_select_authenticated"
  on holidays for select
  using (auth.uid() is not null);

create policy "holidays_admin_write"
  on holidays for all
  using (is_admin())
  with check (is_admin());

-- ------------------------------------------------------------
-- attendance_records
-- ------------------------------------------------------------
create policy "attendance_select_own_or_admin"
  on attendance_records for select
  using (user_id = auth.uid() or is_admin());

-- Employee TIDAK diberi INSERT/UPDATE langsung (dilakukan via
-- service role di Route Handler). Hanya admin yang punya akses
-- mutasi langsung, untuk kasus koreksi manual dari dashboard admin
-- yang juga tetap dicatat ke audit_logs oleh Route Handler.
create policy "attendance_admin_write"
  on attendance_records for all
  using (is_admin())
  with check (is_admin());

-- ------------------------------------------------------------
-- attendance_events
-- ------------------------------------------------------------
create policy "events_select_own_or_admin"
  on attendance_events for select
  using (user_id = auth.uid() or is_admin());

create policy "events_admin_write"
  on attendance_events for all
  using (is_admin())
  with check (is_admin());

-- ------------------------------------------------------------
-- leave_requests
-- ------------------------------------------------------------
create policy "leave_select_own_or_admin"
  on leave_requests for select
  using (user_id = auth.uid() or is_admin());

create policy "leave_insert_own"
  on leave_requests for insert
  with check (user_id = auth.uid());

create policy "leave_update_own_pending_only"
  on leave_requests for update
  using (user_id = auth.uid() and status = 'PENDING')
  with check (user_id = auth.uid());

create policy "leave_admin_manage"
  on leave_requests for all
  using (is_admin())
  with check (is_admin());

-- ------------------------------------------------------------
-- biometric_credentials — user hanya bisa lihat/kelola credential
-- miliknya sendiri; tidak pernah expose public_key ke user lain.
-- ------------------------------------------------------------
create policy "biometric_select_own"
  on biometric_credentials for select
  using (user_id = auth.uid() or is_admin());

create policy "biometric_manage_own"
  on biometric_credentials for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ------------------------------------------------------------
-- audit_logs — hanya admin yang bisa membaca; penulisan hanya
-- lewat service role di server (tidak ada insert policy untuk
-- authenticated role biasa).
-- ------------------------------------------------------------
create policy "audit_select_admin_only"
  on audit_logs for select
  using (is_admin());
