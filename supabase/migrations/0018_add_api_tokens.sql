-- ============================================================================
-- 0018_add_api_tokens.sql — personal access tokens for the Chrome extension
-- (and any future non-cookie client) to authenticate against /api/extension/*.
--
-- Only a SHA-256 hash of the real token is ever stored — the plaintext is
-- generated server-side, returned to the caller exactly once (POST
-- /api/settings/api-token), and never retrievable again. token_last4 exists
-- purely for display ("rf_live_••••ab12") so a user can tell which token
-- they're looking at without the hash meaning anything to them.
--
-- Same RLS/grant shape as every other user-owned table in this project
-- (0004/0005/0009 for models/profiles, rule 33/35/36): a user may SELECT
-- their own row (to see label/last4/created_at/last_used_at in Settings),
-- but every write — issue or revoke — goes through service_role only
-- (app/api/settings/api-token/route.ts). No insert/update/delete grant is
-- given to authenticated or anon, so there is no client-side path to forge
-- a token row or resurrect a revoked one, mirroring exactly why
-- models.status/profiles.credits are service_role-only writes.
-- ============================================================================

create table if not exists api_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  token_last4 text not null,
  label text not null default 'Chrome Extension',
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists api_tokens_user_id_idx on api_tokens (user_id);

alter table api_tokens enable row level security;

drop policy if exists "api_tokens: owner select" on api_tokens;
create policy "api_tokens: owner select" on api_tokens
  for select using (auth.uid() = user_id);

-- No insert/update/delete policy for anyone — service_role bypasses RLS
-- entirely for issue/revoke, exactly like the profiles.credits writes do.
revoke insert, update, delete on api_tokens from authenticated, anon;
revoke all on api_tokens from anon;
grant select on api_tokens to authenticated;
