-- ============================================================================
-- 0021_atomic_api_token_rotation.sql — close two races in issuing a Chrome
-- extension token (app/api/settings/api-token/route.ts POST):
--
-- 1. It ran as two separate statements (revoke old, then insert new) from
--    application code. If the insert failed, the revoke had already
--    committed — the user's working token was destroyed with nothing to
--    replace it, and Settings gave no indication anything had gone wrong.
--
-- 2. "One active token per user" was an application-level invariant only
--    (revoke-then-insert), not a DB constraint. Two concurrent POSTs (a
--    double-click, two tabs) could each revoke the same already-revoked-or-
--    not-yet-revoked old row and both successfully insert, leaving two
--    simultaneously-active tokens — the GET handler (order by created_at
--    desc limit 1) would only ever surface the newer one, leaving the other
--    live and untracked.
--
-- Fixed the same way rule 17 fixes credit races: move the whole operation
-- into one atomic, service_role-only function instead of two round trips
-- from application code, backed by a partial unique index that makes a
-- second concurrently-active token for the same user impossible even under
-- concurrent callers (the second insert blocks on the index, then fails
-- once the first commits).
-- ============================================================================

create unique index if not exists api_tokens_one_active_per_user
  on api_tokens (user_id)
  where revoked_at is null;

create or replace function rotate_api_token(uid uuid, new_hash text, new_last4 text, new_label text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  update public.api_tokens
  set revoked_at = now()
  where user_id = uid and revoked_at is null;

  insert into public.api_tokens (user_id, token_hash, token_last4, label)
  values (uid, new_hash, new_last4, new_label)
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function rotate_api_token(uuid, text, text, text) from public, anon, authenticated;
grant execute on function rotate_api_token(uuid, text, text, text) to service_role;
