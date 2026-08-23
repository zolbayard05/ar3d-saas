-- ============================================================================
-- 0004_restrict_column_grants.sql — column-level UPDATE privileges
--
-- RLS restricts rows, not columns. The owner-update policies from 0001 let
-- an authenticated user UPDATE any column on a row they own — including
-- ones that must be server-controlled:
--
--   update profiles set credits = 999999 where id = auth.uid();   -- passes RLS
--   update models set status = 'ready', glb_url = '...' where id = <own>;  -- passes RLS
--
-- Both satisfy `auth.uid() = id` / `auth.uid() = user_id`, so the existing
-- USING clauses don't block them. Fixing this at the policy layer would
-- need a WITH CHECK that inspects OLD vs NEW per column, which Postgres RLS
-- can't express directly. Column-level GRANT/REVOKE is the right layer:
-- Postgres checks column privileges on the SET list before RLS is even
-- evaluated, so a disallowed column is rejected outright regardless of row
-- ownership.
--
-- profiles: no column is user-writable. credits/plan/stripe_customer_id are
-- server/webhook-controlled; id and created_at are immutable. UPDATE is
-- revoked from authenticated entirely and the owner-update policy is
-- dropped — there's nothing left for it to gate.
--
-- models: only title and scale are user-editable (renaming a model,
-- adjusting print scale). status/glb_url/usdz_url/provider/provider_job_id/
-- error/source_image_key are written by the generation pipeline under
-- service_role, which keeps its default full-table grant untouched here —
-- only `authenticated` is narrowed.
--
-- All statements are idempotent (REVOKE/GRANT/DROP POLICY IF EXISTS), safe
-- to re-run.
-- ============================================================================

revoke update on profiles from authenticated;

drop policy if exists "profiles: owner update" on profiles;

revoke update on models from authenticated;
grant update (title, scale) on models to authenticated;
