-- ============================================================================
-- 0022_support_multiple_api_tokens.sql — allow more than one simultaneously-
-- active personal access token per user (one per device).
--
-- 0021's "one active token per user" invariant (partial unique index +
-- rotate_api_token) meant issuing a token on a second machine silently
-- killed the first machine's extension — found live: the same user hit
-- this switching from a Windows PC to an iMac mid-project. A single global
-- token was never actually the right model for a multi-device tool.
--
-- Drops 0021's constraint + rotation function, replaces with two narrower
-- functions: issue_api_token (pure insert, no side effect on other rows)
-- and revoke_api_token (revokes exactly one token the caller owns, by id
-- — not "whatever is currently active", since there can now be several).
-- Both service_role-only, same as every other write on this table (0018).
-- ============================================================================

drop index if exists api_tokens_one_active_per_user;
drop function if exists rotate_api_token(uuid, text, text, text);

create or replace function issue_api_token(uid uuid, new_hash text, new_last4 text, new_label text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  insert into public.api_tokens (user_id, token_hash, token_last4, label)
  values (uid, new_hash, new_last4, new_label)
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function issue_api_token(uuid, text, text, text) from public, anon, authenticated;
grant execute on function issue_api_token(uuid, text, text, text) to service_role;

create or replace function revoke_api_token(uid uuid, token_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_id uuid;
begin
  update public.api_tokens
  set revoked_at = now()
  where id = token_id and user_id = uid and revoked_at is null
  returning id into affected_id;

  return affected_id is not null;
end;
$$;

revoke all on function revoke_api_token(uuid, uuid) from public, anon, authenticated;
grant execute on function revoke_api_token(uuid, uuid) to service_role;
