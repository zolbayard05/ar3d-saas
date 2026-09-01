-- ============================================================================
-- 0020_add_increment_credit_service.sql — atomic refund for the one path
-- that can't use refund_credit(model_id, ...) or the credits+1 update it
-- does internally.
--
-- lib/generateModel.ts refunds a credit in two places where no models row
-- exists yet to key a refund off of (the models insert itself failed, or
-- collided on idempotency_key): a plain read-then-write
-- `SELECT credits` + `UPDATE credits = <read value> + 1` from application
-- code. That's the same read-then-write shape rule 17 forbids for
-- deduction, just on the refund side — two submitGeneration() calls for the
-- same user failing at nearly the same time (now two entry points, web app
-- and extension, doubling how often that's possible) can both read the same
-- starting value and one refund is silently lost.
--
-- Same fix as consume_credit_service: a single atomic UPDATE statement,
-- service_role-only since the caller (lib/generateModel.ts, already running
-- under the admin client at that point) is the entire trust boundary — no
-- auth.uid() check to make, same as refund_credit/consume_credit_service.
-- ============================================================================

create or replace function increment_credit_service(uid uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
  set credits = credits + 1
  where id = uid;
$$;

revoke all on function increment_credit_service(uuid) from public, anon, authenticated;
grant execute on function increment_credit_service(uuid) to service_role;
