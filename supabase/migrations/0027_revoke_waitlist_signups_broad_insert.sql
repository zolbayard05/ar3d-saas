-- ============================================================================
-- 0027_revoke_waitlist_signups_broad_insert.sql
--
-- 0025 granted `insert (email, source)` to anon/authenticated on
-- waitlist_signups, but never revoked the broad table-level INSERT that
-- Supabase's default-privileges auto-grant hands both roles on CREATE
-- TABLE (rule 36's own documented behavior) before layering the
-- column-scoped grant on top. A column-level GRANT only adds privileges in
-- Postgres — it doesn't narrow a pre-existing table-wide one, so the
-- default broad INSERT was very plausibly still live on HEAD, letting a
-- caller set `id`/`created_at` explicitly on their own insert.
--
-- 0016 (credit_purchases) and 0018 (api_tokens) both already establish the
-- right shape for a brand-new table: revoke the broad grant first, then
-- add back only the narrow column grant actually wanted. 0025 skipped the
-- revoke step.
--
-- Low impact here specifically — waitlist_signups has no ownership model
-- and no read exposure, worst case is a spoofed created_at/id on a
-- marketing email capture row — but closing it anyway for the same reason
-- 0009/0026 close the equivalent gaps elsewhere: "the safety happens to be
-- on" (no policy currently lets anyone exploit it further) isn't the same
-- as "there's no loaded gun."
-- ============================================================================

revoke insert on waitlist_signups from anon, authenticated;
grant insert (email, source) on waitlist_signups to anon, authenticated;
