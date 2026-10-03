-- ============================================================
-- 004_hardening_and_triggers.sql
-- 1) Profil otomatis dibuat saat user baru terdaftar di Supabase Auth
--    (tanpa ini, user yang login tidak punya profil -> semua API 401).
-- 2) Menutup celah privilege escalation di RLS:
--    - employee bisa meng-update role/is_active miliknya sendiri
--    - employee bisa mengubah status pengajuan izin jadi APPROVED
-- 3) is_admin() dikunci search_path-nya.
-- Aman dijalankan ulang (idempotent).
-- ============================================================

-- ---- 1) Auto-create profile ---------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1)),
    new.email,
    'employee'            -- role TIDAK PERNAH diambil dari metadata user
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Profil untuk user yang sudah terlanjur ada sebelum trigger dipasang.
insert into public.profiles (id, full_name, email, role)
select u.id,
       coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), split_part(u.email, '@', 1)),
       u.email,
       'employee'
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- ---- 2a) Kunci kolom sensitif profiles ----------------------
create or replace function public.guard_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() null = service role / SQL editor -> diizinkan.
  if auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role
       or new.is_active is distinct from old.is_active
       or new.employee_code is distinct from old.employee_code
       or new.id is distinct from old.id then
      raise exception 'Perubahan role/status/kode karyawan hanya boleh dilakukan admin'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_profile_columns on public.profiles;
create trigger trg_guard_profile_columns
  before update on public.profiles
  for each row execute function public.guard_profile_columns();

-- ---- 2b) Pengajuan izin: employee hanya boleh membuat PENDING ----
drop policy if exists "leave_insert_own" on public.leave_requests;
create policy "leave_insert_own"
  on public.leave_requests for insert
  with check (user_id = auth.uid() and status = 'PENDING');

drop policy if exists "leave_update_own_pending_only" on public.leave_requests;
create policy "leave_update_own_pending_only"
  on public.leave_requests for update
  using (user_id = auth.uid() and status = 'PENDING')
  with check (user_id = auth.uid() and status = 'PENDING');

-- ---- 3) is_admin() dengan search_path terkunci --------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active = true
  );
$$;

-- ---- Index tambahan untuk query rekap ----------------------
create index if not exists idx_leave_status_date on public.leave_requests (status, leave_date);
