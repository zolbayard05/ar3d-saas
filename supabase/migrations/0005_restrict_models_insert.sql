-- ============================================================================
-- 0005_restrict_models_insert.sql — close an INSERT-side column-privilege gap
--
-- 0004 locked down UPDATE column privileges (rule 33/34) but left INSERT
-- alone. The "models: owner insert" policy (0001) only checks
-- `auth.uid() = user_id` — it says nothing about which columns the inserted
-- row can set. Nothing stopped an authenticated client from doing:
--
--   insert into models (user_id, source_image_key, status, glb_url)
--   values (auth.uid(), 'x', 'ready', 'https://evil.example/fake.glb');
--
-- That satisfies the row-ownership check and self-grants a "completed" model
-- without ever calling consume_credit or waiting for the generation
-- pipeline — a revenue bug (rule 17), not just a display bug, and exactly
-- the class of gap rule 33 describes, just on INSERT instead of UPDATE.
--
-- Phase 3's /api/generate is the only legitimate creator of a models row —
-- it couples the insert to an atomic consume_credit() call — and it always
-- runs under service_role, which bypasses RLS entirely. So, same as
-- `profiles` in 0004 (no user-writable columns there either), there is
-- nothing left for `authenticated` to legitimately do via a direct
-- client-side insert. Revoke it entirely rather than trying to enumerate a
-- safe column allowlist.
--
-- Also adds usdz_provider_job_id: Tripo's image-to-model task produces a
-- GLB; a second, separate /models/convert task (its own task_id) produces
-- the USDZ (rule 1 requires both). The webhook handler needs a column to
-- match an incoming USDZ-conversion webhook event back to its model row,
-- parallel to how provider_job_id already does this for the GLB task.
--
-- All statements are idempotent, safe to re-run.
-- ============================================================================

revoke insert on models from authenticated;
drop policy if exists "models: owner insert" on models;

alter table models add column if not exists usdz_provider_job_id text;
create index if not exists models_usdz_provider_job_id_idx on models (usdz_provider_job_id);

-- Rule 14: client updates come from Realtime, never polling. Postgres
-- Changes only emits events for tables added to this publication, and
-- (since models has RLS enabled) still enforces the existing owner-select
-- policy per-subscriber — a user only receives change events for their own
-- rows, no new policy needed.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'models'
  ) then
    alter publication supabase_realtime add table models;
  end if;
end $$;
