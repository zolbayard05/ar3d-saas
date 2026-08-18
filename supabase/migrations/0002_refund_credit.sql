-- ============================================================================
-- 0002_refund_credit.sql — atomic, idempotent refund for failed generations
--
-- consume_credit() checks `uid = auth.uid()`, which is correct for the
-- user-initiated /api/generate path but is null when this runs from the
-- Tripo webhook handler under service_role — so it can never be reused for
-- refunds. This is a separate function for that path.
--
-- Idempotency: provider webhooks retry on timeout/5xx, so a "mark failed +
-- refund" sequence issued as two statements would double-refund on a
-- retried delivery. Instead the status transition IS the idempotency guard:
-- the UPDATE only matches (and only refunds) on the *first* call that
-- moves a row into 'failed'; a retry finds status already 'failed', the
-- WHERE clause matches zero rows, and the function is a no-op. This is
-- one statement, so Postgres's row lock makes it safe under concurrent
-- duplicate deliveries too — no separate check-then-act gap.
--
-- Callers (the webhook handler, once Phase 3 builds it) MUST transition a
-- model to 'failed' only through this function — never via a bare
-- `update models set status = 'failed'` — or this guarantee doesn't hold.
-- ============================================================================

create or replace function refund_credit(model_id uuid, failure_reason text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_user uuid;
begin
  update public.models
  set status = 'failed',
      error = coalesce(failure_reason, error)
  where id = model_id
    and status <> 'failed'
  returning user_id into affected_user;

  if affected_user is null then
    -- Either the model doesn't exist, or it's already 'failed' (a retried
    -- webhook delivery) — already refunded, so do nothing.
    return false;
  end if;

  update public.profiles
  set credits = credits + 1
  where id = affected_user;

  return true;
end;
$$;

revoke all on function refund_credit(uuid, text) from public;
grant execute on function refund_credit(uuid, text) to service_role;
