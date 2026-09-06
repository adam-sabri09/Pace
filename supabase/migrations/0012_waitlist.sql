-- Waitlist: email capture for early access sign-ups.
-- Inserts are performed server-side via the service client (bypasses RLS).
-- No read, update, or delete policies — waitlist data is internal only.

create table if not exists public.waitlist (
  id         uuid        primary key default gen_random_uuid(),
  email      text        not null,
  source     text        not null default 'landing',
  created_at timestamptz not null default now(),
  constraint waitlist_email_key unique (email)
);

alter table public.waitlist enable row level security;
