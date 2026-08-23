-- Pace — initial schema.
-- Mirrors DATABASE.md exactly. Every user-owned table has RLS enabled and
-- policies restricted to (user_id = auth.uid()); the profiles table uses (id = auth.uid())
-- because the profile row IS the user row.

-- =========================================================================
-- Tables
-- =========================================================================

create table public.profiles (
  id                         uuid primary key references auth.users(id) on delete cascade,
  created_at                 timestamptz not null default now(),
  first_name                 text,
  age_confirmed_13_plus      boolean not null default false,
  session_length_minutes     int,
  time_zone                  text,
  constraint session_length_minutes_valid
    check (session_length_minutes is null or session_length_minutes in (25, 45, 60))
);

create table public.availability_windows (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  day_of_week  int  not null,
  starts_at    time not null,
  ends_at      time not null,
  constraint day_of_week_valid check (day_of_week between 0 and 6),
  constraint window_end_after_start check (ends_at > starts_at)
);
create index availability_windows_user_day_idx
  on public.availability_windows (user_id, day_of_week);

create table public.subjects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  exam_date   date,
  created_at  timestamptz not null default now()
);

create table public.topics (
  id          uuid primary key default gen_random_uuid(),
  subject_id  uuid not null references public.subjects(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now()
);

create table public.plans (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles(id) on delete cascade,
  is_active            boolean not null default true,
  generated_at         timestamptz not null default now(),
  last_replanned_at    timestamptz
);
-- At most one active plan per user (DECISIONS.md D17).
create unique index plans_one_active_per_user_idx
  on public.plans (user_id) where is_active;

create table public.sessions (
  id                uuid primary key default gen_random_uuid(),
  plan_id           uuid not null references public.plans(id) on delete cascade,
  user_id           uuid not null references public.profiles(id) on delete cascade,
  topic_id          uuid not null references public.topics(id) on delete cascade,
  starts_at         timestamptz not null,
  duration_minutes  int not null,
  instruction       text not null,
  status            text not null default 'scheduled',
  completed_at      timestamptz,
  constraint session_status_valid
    check (status in ('scheduled', 'completed', 'missed'))
);
create index sessions_user_starts_idx
  on public.sessions (user_id, starts_at);

-- =========================================================================
-- Row Level Security
-- =========================================================================

alter table public.profiles              enable row level security;
alter table public.availability_windows  enable row level security;
alter table public.subjects              enable row level security;
alter table public.topics                enable row level security;
alter table public.plans                 enable row level security;
alter table public.sessions              enable row level security;

-- profiles — the "user_id" column is the primary key `id`.
create policy profiles_select_own on public.profiles
  for select using ( id = (select auth.uid()) );
create policy profiles_insert_own on public.profiles
  for insert with check ( id = (select auth.uid()) );
create policy profiles_update_own on public.profiles
  for update using ( id = (select auth.uid()) )
             with check ( id = (select auth.uid()) );
create policy profiles_delete_own on public.profiles
  for delete using ( id = (select auth.uid()) );

-- availability_windows
create policy availability_windows_select_own on public.availability_windows
  for select using ( user_id = (select auth.uid()) );
create policy availability_windows_insert_own on public.availability_windows
  for insert with check ( user_id = (select auth.uid()) );
create policy availability_windows_update_own on public.availability_windows
  for update using ( user_id = (select auth.uid()) )
             with check ( user_id = (select auth.uid()) );
create policy availability_windows_delete_own on public.availability_windows
  for delete using ( user_id = (select auth.uid()) );

-- subjects
create policy subjects_select_own on public.subjects
  for select using ( user_id = (select auth.uid()) );
create policy subjects_insert_own on public.subjects
  for insert with check ( user_id = (select auth.uid()) );
create policy subjects_update_own on public.subjects
  for update using ( user_id = (select auth.uid()) )
             with check ( user_id = (select auth.uid()) );
create policy subjects_delete_own on public.subjects
  for delete using ( user_id = (select auth.uid()) );

-- topics
create policy topics_select_own on public.topics
  for select using ( user_id = (select auth.uid()) );
create policy topics_insert_own on public.topics
  for insert with check ( user_id = (select auth.uid()) );
create policy topics_update_own on public.topics
  for update using ( user_id = (select auth.uid()) )
             with check ( user_id = (select auth.uid()) );
create policy topics_delete_own on public.topics
  for delete using ( user_id = (select auth.uid()) );

-- plans
create policy plans_select_own on public.plans
  for select using ( user_id = (select auth.uid()) );
create policy plans_insert_own on public.plans
  for insert with check ( user_id = (select auth.uid()) );
create policy plans_update_own on public.plans
  for update using ( user_id = (select auth.uid()) )
             with check ( user_id = (select auth.uid()) );
create policy plans_delete_own on public.plans
  for delete using ( user_id = (select auth.uid()) );

-- sessions
create policy sessions_select_own on public.sessions
  for select using ( user_id = (select auth.uid()) );
create policy sessions_insert_own on public.sessions
  for insert with check ( user_id = (select auth.uid()) );
create policy sessions_update_own on public.sessions
  for update using ( user_id = (select auth.uid()) )
             with check ( user_id = (select auth.uid()) );
create policy sessions_delete_own on public.sessions
  for delete using ( user_id = (select auth.uid()) );

-- =========================================================================
-- Auto-create a profile row when a new auth.users row is inserted.
-- The signup server action then updates first_name / age_confirmed_13_plus /
-- time_zone in the same session. `security definer` is required so the
-- trigger can write to public.profiles without RLS blocking it.
-- =========================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
