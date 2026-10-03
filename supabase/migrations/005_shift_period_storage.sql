-- ============================================================
-- 005_shift_period_storage.sql
-- 1) Kategori shift (PAGI / SORE / MALAM) pada absensi.
-- 2) Bucket Storage "attendance-selfies" + policy RLS-nya
--    (sebelumnya TIDAK ada -> upload selfie selalu gagal).
-- 3) Fungsi rekap bulanan mengikuti periode pembukuan 21 s/d 20.
-- Aman dijalankan ulang (idempotent). Jalankan di Supabase SQL Editor.
-- ============================================================

-- ---- 1) Shift -----------------------------------------------
alter table public.attendance_records
  add column if not exists shift text;

alter table public.attendance_records
  drop constraint if exists attendance_records_shift_check;
alter table public.attendance_records
  add constraint attendance_records_shift_check
  check (shift is null or shift in ('PAGI', 'SORE', 'MALAM'));

create index if not exists idx_attendance_shift on public.attendance_records (shift)
  where shift is not null;

-- ---- 2) Storage selfie --------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attendance-selfies', 'attendance-selfies', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "selfie_insert_own_folder" on storage.objects;
create policy "selfie_insert_own_folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'attendance-selfies'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "selfie_select_own_or_admin" on storage.objects;
create policy "selfie_select_own_or_admin"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'attendance-selfies'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- ---- 3) Rekap periode 21 s/d 20 -----------------------------
-- Periode dinamai menurut bulan akhirnya: p_year/p_month = 2026/10
-- berarti 21 Sep 2026 s/d 20 Okt 2026.
create or replace function public.monthly_attendance_summary(p_user_id uuid, p_year int, p_month int)
returns table (
  work_days bigint,
  present_days bigint,
  absent_days bigint,
  permission_days bigint,
  sick_days bigint,
  holiday_days bigint,
  total_net_minutes bigint,
  total_overtime_minutes bigint
) as $$
  select
    count(*) filter (where status not in ('HOLIDAY', 'DAY_OFF')) as work_days,
    count(*) filter (where status = 'PRESENT') as present_days,
    count(*) filter (where status = 'ABSENT') as absent_days,
    count(*) filter (where status = 'PERMISSION') as permission_days,
    count(*) filter (where status = 'SICK') as sick_days,
    count(*) filter (where status = 'HOLIDAY') as holiday_days,
    coalesce(sum(net_work_minutes), 0) as total_net_minutes,
    coalesce(sum(overtime_minutes), 0) as total_overtime_minutes
  from attendance_records
  where user_id = p_user_id
    and work_date >= (make_date(p_year, p_month, 1) - interval '1 month' + interval '20 days')::date
    and work_date <= make_date(p_year, p_month, 20);
$$ language sql stable;
