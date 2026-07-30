-- Visual AI Agent — Postgres schema (Supabase)
-- Apply in the Supabase SQL editor, or via `supabase db push`.
--
-- Design notes:
--  * Every table is scoped to a user and protected by Row-Level Security so a user
--    can only ever read/write their own rows.
--  * Raw screenshots live in Supabase Storage (bucket `captures`), NOT in Postgres.
--    We store only the storage path + AI-derived fields here.
--  * The backend uses the service-role key and sets the acting user explicitly,
--    so RLS is enforced consistently for both extension and dashboard access.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- users -------
create table if not exists app_users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique,
  -- sha-256 of the bearer token the extension sends (never store the raw token)
  token_hash    text not null unique,
  created_at    timestamptz not null default now()
);

-- --------------------------------------------------------------- sessions -----
-- A session groups activity between browser focus/idle boundaries (optional).
create table if not exists sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references app_users(id) on delete cascade,
  started_at    timestamptz not null default now(),
  ended_at      timestamptz
);

-- ------------------------------------------------------------ activity_events -
create table if not exists activity_events (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references app_users(id) on delete cascade,
  kind          text not null,
  url           text,
  title         text,
  origin        text,
  tab_id        integer,
  clicks        integer,
  scrolls       integer,
  keypresses    integer,
  active_ms     integer,
  occurred_at   timestamptz not null,
  created_at    timestamptz not null default now()
);
create index if not exists idx_events_user_time on activity_events (user_id, occurred_at desc);

-- ---------------------------------------------------------------- captures ----
create type capture_status as enum ('pending', 'processed', 'skipped', 'failed');

create table if not exists captures (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references app_users(id) on delete cascade,
  url              text,
  title            text,
  origin           text,
  phash            text,
  width            integer,
  height           integer,
  -- storage path in the `captures` bucket; null when text-only / after retention purge
  image_path       text,
  -- when true, the worker deletes the raw image after deriving text (privacy mode)
  text_only        boolean not null default false,
  status           capture_status not null default 'pending',
  -- Claude vision output
  app              text,
  task             text,
  category         text,
  entities         text[],
  summary          text,
  contains_sensitive boolean,
  occurred_at      timestamptz not null,
  processed_at     timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists idx_captures_user_time on captures (user_id, occurred_at desc);
create index if not exists idx_captures_status on captures (status) where status = 'pending';

-- ----------------------------------------------------------- daily_summaries --
create table if not exists daily_summaries (
  user_id       uuid not null references app_users(id) on delete cascade,
  day           date not null,
  category      text not null,
  seconds       integer not null default 0,
  capture_count integer not null default 0,
  primary key (user_id, day, category)
);

-- ----------------------------------------------------------------- RLS ---------
alter table app_users       enable row level security;
alter table sessions        enable row level security;
alter table activity_events enable row level security;
alter table captures        enable row level security;
alter table daily_summaries enable row level security;

-- The backend sets `request.jwt.claims` -> sub, OR uses set_config('app.user_id', ...).
-- Helper that reads the current user id set by the backend per request.
create or replace function current_app_user() returns uuid
language sql stable as $$
  select nullif(current_setting('app.user_id', true), '')::uuid
$$;

-- Policies: a row is visible/writable only to its owner.
create policy own_users   on app_users       using (id = current_app_user());
create policy own_sess    on sessions         using (user_id = current_app_user()) with check (user_id = current_app_user());
create policy own_events  on activity_events  using (user_id = current_app_user()) with check (user_id = current_app_user());
create policy own_caps    on captures         using (user_id = current_app_user()) with check (user_id = current_app_user());
create policy own_sum     on daily_summaries  using (user_id = current_app_user()) with check (user_id = current_app_user());
