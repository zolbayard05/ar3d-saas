-- ============================================================================
-- 0019_add_consume_credit_service.sql — service_role twin of consume_credit,
-- for the token-authed Chrome extension path.
--
-- consume_credit(uid) (0001_init.sql) deliberately checks `uid = auth.uid()`
-- and is granted ONLY to `authenticated` (0003_fix_function_grants.sql
-- explicitly revokes it from service_role) — that check is exactly right
-- for the cookie-based web app, where auth.uid() comes from the caller's
-- own Supabase JWT. It's the wrong tool for app/api/extension/*: a
-- token-authed request has no Supabase JWT at all (lib/apiToken.ts resolves
-- a personal access token to a plain uuid, not a session), so auth.uid()
-- would just be null and the check would always fail.
--
-- This is not a weaker check, just a different one: lib/apiToken.ts's
-- resolveApiToken() IS the identity verification for that call path (a
-- request only ever reaches this function after its bearer token was
-- looked up and matched to a user_id) — exactly the same shape as
-- refund_credit(model_id, ...) already being service_role-only and
-- trusting its model_id argument for the webhook's privileged-but-verified
-- caller. Same atomic UPDATE...WHERE credits > 0 RETURNING as
-- consume_credit — rule 17's guarantee is unchanged, just reachable from a
-- second, differently-authenticated caller.
--
-- Never grant this to authenticated or anon — unlike consume_credit, it
-- has no internal check of its own; the grant boundary (service_role only)
-- IS the entire protection, same as refund_credit.
-- ============================================================================

create or replace function consume_credit_service(uid uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_id uuid;
begin
  update public.profiles
  set credits = credits - 1
  where id = uid and credits > 0
  returning id into affected_id;

  return affected_id is not null;
end;
$$;

revoke all on function consume_credit_service(uuid) from public, anon, authenticated;
grant execute on function consume_credit_service(uuid) to service_role;
