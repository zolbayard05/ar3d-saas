-- ============================================================================
-- 0003_fix_function_grants.sql — close the anon/authenticated execute gap
--
-- 0001/0002 did `revoke all on function X from public`, intending that to be
-- the sole lockdown. On Supabase that's not enough: the project's
-- `ALTER DEFAULT PRIVILEGES` on schema public grants EXECUTE to anon,
-- authenticated, and service_role directly at function-creation time —
-- separate ACL entries, not derived from the PUBLIC pseudo-role. Revoking
-- from public alone left anon able to call consume_credit, and left both
-- anon and authenticated able to call refund_credit (which has no internal
-- auth.uid() check — unlike consume_credit — so it relied entirely on the
-- grant to stay service_role-only).
--
-- This migration applies the same fix now folded into 0001/0002 for any
-- environment that was provisioned before this file existed. All statements
-- are idempotent REVOKE/GRANT — safe to run again on a database that
-- already has the fix (from a fresh 0001/0002 apply) or already had this
-- migration applied.
-- ============================================================================

revoke all on function consume_credit(uuid) from public, anon, service_role;
grant execute on function consume_credit(uuid) to authenticated;

revoke all on function refund_credit(uuid, text) from public, anon, authenticated;
grant execute on function refund_credit(uuid, text) to service_role;
