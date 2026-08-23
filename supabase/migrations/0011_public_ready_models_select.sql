-- ============================================================================
-- 0011_public_ready_models_select.sql — public read of ready models, for
-- shared links / QR codes to work without an account
--
-- The whole point of a shareable AR link is that it works for someone who
-- has never signed in. Right now "models: owner select" (0001) is the only
-- SELECT policy on this table, so an anonymous or non-owner request returns
-- no row and the shared link is dead. This adds a second, narrow permissive
-- policy rather than widening the owner one:
--
--   for select using (status = 'ready')
--
-- Postgres RLS combines multiple permissive policies for the same command
-- with OR, so this only ever *adds* visibility — the owner-select policy is
-- untouched, and an owner still sees their own pending/processing/failed
-- rows same as before.
--
-- status = 'ready' is the condition itself, not a check moved into route
-- code: a pending/processing row has no glb_url/usdz_url yet, and a failed
-- row is a dead end — neither should be fetchable by a stranger regardless
-- of what any given page happens to render. No role restriction (no `to`
-- clause = PUBLIC) — this must work for both anon and authenticated
-- requests, since the link's whole premise is "works for anyone."
--
-- SELECT only. No corresponding INSERT/UPDATE/DELETE policy is added here —
-- anon's write privileges stay revoked (0009) and authenticated's column
-- grants stay as narrowed by 0004/0005. This migration widens exactly one
-- thing: read access to already-finished rows.
--
-- Table-level SELECT grant to anon already exists (Supabase's default
-- ALTER DEFAULT PRIVILEGES, confirmed via information_schema.role_table_
-- grants) — it was RLS alone blocking anon reads until now, not a missing
-- grant, so no GRANT statement is needed here.
--
-- Idempotent, safe to re-run.
-- ============================================================================

drop policy if exists "models: public select ready" on models;
create policy "models: public select ready" on models
  for select using (status = 'ready');
