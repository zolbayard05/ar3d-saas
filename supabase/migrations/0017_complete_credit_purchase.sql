-- ============================================================================
-- 0017_complete_credit_purchase.sql — atomic, idempotent credit grant on a
-- successful wire.mn payment.
--
-- Mirrors 0002_refund_credit.sql's own shape exactly: the status transition
-- IS the idempotency guard (rule 16 — wire.mn's own webhook guide says the
-- same thing almost verbatim: "Idempotent бай — ижил event нэгээс олон удаа
-- delivery хийгдэж болно"). The UPDATE only matches (and only grants
-- credits) on the *first* call that moves a row into 'completed'; a retried
-- webhook delivery finds status already 'completed', the WHERE clause
-- matches zero rows, and the function is a no-op — one statement, so
-- Postgres's row lock makes this safe under concurrent duplicate deliveries
-- too, no separate check-then-act gap.
--
-- Callers (app/api/webhooks/wire/route.ts) MUST transition a credit_purchases
-- row to 'completed' only through this function — never via a bare
-- `update credit_purchases set status = 'completed'` — or this guarantee
-- doesn't hold.
-- ============================================================================

create or replace function complete_credit_purchase(purchase_id uuid, payment_id text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_user uuid;
  granted_credits int;
begin
  update public.credit_purchases
  set status = 'completed',
      provider_payment_id = coalesce(payment_id, provider_payment_id),
      updated_at = now()
  where id = purchase_id
    and status <> 'completed'
  returning user_id, credits into affected_user, granted_credits;

  if affected_user is null then
    -- Either the row doesn't exist, or it's already 'completed' (a retried
    -- webhook delivery) — already granted, so do nothing.
    return false;
  end if;

  update public.profiles
  set credits = credits + granted_credits
  where id = affected_user;

  return true;
end;
$$;

revoke all on function complete_credit_purchase(uuid, text) from public, anon, authenticated;
grant execute on function complete_credit_purchase(uuid, text) to service_role;
