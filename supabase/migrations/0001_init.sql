-- ============================================================================
-- 0001_init.sql — profiles, models, RLS, signup trigger, consume_credit()
--
-- Apply via the Supabase CLI (`supabase db push`) or paste into the SQL
-- editor of a linked project. gen_random_uuid() ships in core Postgres 13+
-- (no `create extension pgcrypto` needed on current Supabase projects).
-- ============================================================================

create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  credits int not null default 10,
  plan text not null default 'free',
  stripe_customer_id text,
  created_at timestamptz not null default now()
);

create table if not exists models (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text,
  status text not null default 'pending'
    constraint models_status_check check (status in ('pending', 'processing', 'ready', 'failed')),
  source_image_key text not null,
  glb_url text,
  usdz_url text,
  provider text,
  provider_job_id text,
  scale numeric not null default 1,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists models_provider_job_id_idx on models (provider_job_id);
create index if not exists models_user_id_created_at_idx on models (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists models_set_updated_at on models;
create trigger models_set_updated_at
  before update on models
  for each row
  execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-create a profile row on signup
-- ---------------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- Atomic credit deduction — UPDATE ... WHERE credits > 0 RETURNING is a
-- single statement, so Postgres row-locks the profile row for its
-- duration. A read-then-write pattern (SELECT credits, check in app code,
-- then UPDATE) would let two concurrent requests both read "1 credit left"
-- and both succeed — this can't, by construction.
--
-- `uid` is still validated against auth.uid() so a client can't drain
-- someone else's balance by passing an arbitrary id, even though the
-- function is SECURITY DEFINER (needed so it can update a row RLS would
-- otherwise block the caller from touching directly... it can't, since
-- owner-only UPDATE policy below already allows self-updates; DEFINER is
-- kept anyway so the function's execution isn't dependent on the caller
-- also having table-level UPDATE granted, keeping grants minimal).
-- ---------------------------------------------------------------------------
create or replace function consume_credit(uid uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_id uuid;
begin
  if uid <> auth.uid() then
    raise exception 'consume_credit: uid must match the authenticated user';
  end if;

  update public.profiles
  set credits = credits - 1
  where id = uid and credits > 0
  returning id into affected_id;

  return affected_id is not null;
end;
$$;

revoke all on function consume_credit(uuid) from public;
grant execute on function consume_credit(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS — owner-only on every table
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table models enable row level security;

drop policy if exists "profiles: owner select" on profiles;
create policy "profiles: owner select" on profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles: owner update" on profiles;
create policy "profiles: owner update" on profiles
  for update using (auth.uid() = id);

-- No insert/delete policy for profiles: rows are created only by the
-- handle_new_user() trigger (SECURITY DEFINER, bypasses RLS) and never
-- deleted directly by users (cascades from auth.users on account deletion).

drop policy if exists "models: owner select" on models;
create policy "models: owner select" on models
  for select using (auth.uid() = user_id);

drop policy if exists "models: owner insert" on models;
create policy "models: owner insert" on models
  for insert with check (auth.uid() = user_id);

drop policy if exists "models: owner update" on models;
create policy "models: owner update" on models
  for update using (auth.uid() = user_id);

drop policy if exists "models: owner delete" on models;
create policy "models: owner delete" on models
  for delete using (auth.uid() = user_id);
