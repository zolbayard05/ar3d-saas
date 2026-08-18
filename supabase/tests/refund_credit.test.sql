-- ============================================================================
-- refund_credit idempotency test
--
-- Proves: calling refund_credit() twice on the same model increases the
-- user's credit balance by exactly 1, not 2 — i.e. a retried webhook
-- delivery can't grant a free credit.
--
-- HOW TO RUN
-- 1. Needs one real auth.users row (profiles.id has an FK to it — you
--    can't fabricate one inline). Sign up a throwaway user through the app
--    first, then find their id: select id from auth.users limit 1;
-- 2. Paste that id into TEST_USER below.
-- 3. Run this whole file in the Supabase SQL editor. It runs as one
--    transaction and ROLLBACKs at the end, so it leaves no trace
--    regardless of pass/fail — safe to run against a real project.
-- 4. Read the RAISE NOTICE output for PASS/FAIL lines.
-- ============================================================================

begin;

do $$
declare
  test_user uuid := '00000000-0000-0000-0000-000000000000'; -- <-- replace
  test_model uuid;
  credits_before int;
  credits_after_first int;
  credits_after_second int;
  first_call_result boolean;
  second_call_result boolean;
begin
  select credits into credits_before from public.profiles where id = test_user;
  if credits_before is null then
    raise exception 'No profile found for %; replace TEST_USER with a real auth.users id first', test_user;
  end if;

  insert into public.models (id, user_id, source_image_key, status)
  values (gen_random_uuid(), test_user, 'test/probe.jpg', 'processing')
  returning id into test_model;

  first_call_result := refund_credit(test_model, 'test: simulated provider failure');
  select credits into credits_after_first from public.profiles where id = test_user;

  second_call_result := refund_credit(test_model, 'test: simulated retried webhook delivery');
  select credits into credits_after_second from public.profiles where id = test_user;

  raise notice 'credits_before=%, after 1st call=% (result=%), after 2nd call=% (result=%)',
    credits_before, credits_after_first, first_call_result, credits_after_second, second_call_result;

  if first_call_result is true
     and credits_after_first = credits_before + 1
     and second_call_result is false
     and credits_after_second = credits_after_first then
    raise notice 'PASS: refund applied exactly once across two calls';
  else
    raise exception 'FAIL: expected +1 credit after call 1 and no change after call 2, got before=% after1=% after2=%',
      credits_before, credits_after_first, credits_after_second;
  end if;
end $$;

rollback;
