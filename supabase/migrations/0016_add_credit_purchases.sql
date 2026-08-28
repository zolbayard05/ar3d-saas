-- ---------------------------------------------------------------------------
-- Credit purchases — one row per checkout attempt (wire.mn payment
-- integration, pending on real API credentials). Mirrors `models`' own
-- async pattern (rule 12/13: insert pending -> provider does its thing ->
-- webhook flips the row) and its write-boundary lessons (rule 33/35/36,
-- this project's hit that class of bug three times already on other
-- tables): every write here goes through service_role — the checkout route
-- inserts the pending row, the wire.mn webhook flips it to
-- completed/failed and, on success, credits the profile — never a
-- client-side .insert()/.update(). No insert/update/delete RLS policy
-- exists for `authenticated`/`anon` because none should: explicit revokes
-- below close the table-level-grant gap rather than relying on "no policy"
-- alone, since Supabase's default-privileges auto-grant on CREATE TABLE
-- would otherwise leave those roles able to write directly.
-- ---------------------------------------------------------------------------
create table if not exists credit_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  credits int not null,
  amount_mnt int not null,
  status text not null default 'pending',
  provider text not null default 'wire',
  provider_payment_id text,
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table credit_purchases enable row level security;

drop policy if exists "credit_purchases: owner select" on credit_purchases;
create policy "credit_purchases: owner select" on credit_purchases
  for select using (auth.uid() = user_id);

revoke insert, update, delete on credit_purchases from authenticated;
revoke insert, update, delete on credit_purchases from anon;
revoke select on credit_purchases from anon;
