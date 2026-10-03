-- ============================================================
-- 001_initial_schema.sql
-- Skema inti sistem absensi. Semua timestamp disimpan sebagai
-- timestamptz (UTC). Konversi ke Asia/Jakarta dilakukan di
-- application layer / view, TIDAK di kolom penyimpanan.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- profiles
-- ------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  employee_code text unique,
  full_name text not null,
  email text,
  phone text,
  role text not null check (role in ('admin', 'employee')) default 'employee',
  position text,
  department text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- work_settings (single-row config table; multiple rows allowed
-- for future multi-shift support, but v1 uses the latest row)
-- ------------------------------------------------------------
create table if not exists work_settings (
  id uuid primary key default gen_random_uuid(),
  work_start_time time not null default '08:00',
  work_end_time time not null default '17:00',
  break_minutes integer not null default 60,
  standard_work_minutes integer not null default 480,
  overtime_rounding_minutes integer not null default 60,
  timezone text not null default 'Asia/Jakarta',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into work_settings (work_start_time, work_end_time, break_minutes, standard_work_minutes, overtime_rounding_minutes, timezone)
select '08:00', '17:00', 60, 480, 60, 'Asia/Jakarta'
where not exists (select 1 from work_settings);

-- ------------------------------------------------------------
-- holidays
-- ------------------------------------------------------------
create table if not exists holidays (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- attendance_records
-- Satu baris per user per work_date (unique constraint di bawah).
-- ------------------------------------------------------------
create table if not exists attendance_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  work_date date not null,

  check_in_at timestamptz,
  check_out_at timestamptz,

  break_minutes integer not null default 60,

  gross_work_minutes integer not null default 0,
  net_work_minutes integer not null default 0,
  overtime_minutes integer not null default 0,

  status text not null default 'ABSENT'
    check (status in ('PRESENT', 'ABSENT', 'PERMISSION', 'SICK', 'HOLIDAY', 'DAY_OFF')),

  notes text,

  check_in_method text check (check_in_method in ('SELFIE', 'BIOMETRIC', 'MANUAL')),
  check_out_method text check (check_out_method in ('SELFIE', 'BIOMETRIC', 'MANUAL')),

  check_in_photo_path text,
  check_out_photo_path text,

  check_in_latitude numeric,
  check_in_longitude numeric,
  check_out_latitude numeric,
  check_out_longitude numeric,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint uq_attendance_user_date unique (user_id, work_date)
);

create index if not exists idx_attendance_user_date on attendance_records (user_id, work_date);
create index if not exists idx_attendance_work_date on attendance_records (work_date);
create index if not exists idx_attendance_status on attendance_records (status);

-- ------------------------------------------------------------
-- attendance_events (append-only event log — histori tidak hilang
-- meski attendance_records dikoreksi)
-- ------------------------------------------------------------
create table if not exists attendance_events (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid references attendance_records(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  event_type text not null check (
    event_type in ('CHECK_IN', 'CHECK_OUT', 'BREAK_START', 'BREAK_END', 'MANUAL_CORRECTION')
  ),
  event_at timestamptz not null default now(),
  method text,
  photo_path text,
  latitude numeric,
  longitude numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_events_attendance_id on attendance_events (attendance_id);
create index if not exists idx_events_user_id on attendance_events (user_id);

-- ------------------------------------------------------------
-- leave_requests
-- ------------------------------------------------------------
create table if not exists leave_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  leave_date date not null,
  leave_type text not null check (leave_type in ('PERMISSION', 'SICK', 'ANNUAL_LEAVE', 'OTHER')),
  reason text,
  attachment_path text,
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_leave_user_date on leave_requests (user_id, leave_date);

-- ------------------------------------------------------------
-- biometric_credentials (WebAuthn — TIDAK menyimpan data biometrik
-- mentah, hanya credential public key)
-- ------------------------------------------------------------
create table if not exists biometric_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  credential_id text not null unique,
  public_key text not null,
  counter bigint not null default 0,
  device_name text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists idx_biometric_user_id on biometric_credentials (user_id);

-- ------------------------------------------------------------
-- audit_logs
-- ------------------------------------------------------------
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_entity on audit_logs (entity_type, entity_id);

-- ------------------------------------------------------------
-- updated_at trigger helper
-- ------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_profiles_updated_at on profiles;
create trigger trg_profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

drop trigger if exists trg_attendance_updated_at on attendance_records;
create trigger trg_attendance_updated_at before update on attendance_records
  for each row execute function set_updated_at();

drop trigger if exists trg_leave_updated_at on leave_requests;
create trigger trg_leave_updated_at before update on leave_requests
  for each row execute function set_updated_at();

drop trigger if exists trg_settings_updated_at on work_settings;
create trigger trg_settings_updated_at before update on work_settings
  for each row execute function set_updated_at();
