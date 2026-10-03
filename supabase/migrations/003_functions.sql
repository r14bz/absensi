-- ============================================================
-- 003_functions.sql
-- Fungsi reporting. SECURITY INVOKER (default) sehingga tetap
-- tunduk pada RLS pemanggil — admin lihat semua, employee hanya
-- lihat miliknya (karena underlying table sudah RLS-protected).
-- ============================================================

create or replace function daily_attendance_summary(p_work_date date)
returns table (
  user_id uuid,
  full_name text,
  check_in_at timestamptz,
  check_out_at timestamptz,
  net_work_minutes integer,
  overtime_minutes integer,
  status text
) as $$
  select
    p.id as user_id,
    p.full_name,
    a.check_in_at,
    a.check_out_at,
    coalesce(a.net_work_minutes, 0),
    coalesce(a.overtime_minutes, 0),
    coalesce(a.status, 'ABSENT')
  from profiles p
  left join attendance_records a
    on a.user_id = p.id and a.work_date = p_work_date
  where p.role = 'employee' and p.is_active = true
  order by p.full_name;
$$ language sql stable;

create or replace function monthly_attendance_summary(p_user_id uuid, p_year int, p_month int)
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
    and extract(year from work_date) = p_year
    and extract(month from work_date) = p_month;
$$ language sql stable;
