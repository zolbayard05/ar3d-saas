-- ---------------------------------------------------------------------------
-- New-signup free credits: 10 -> 1. The initial credit budget is close to
-- exhausted; handle_new_user() (migration 0001) only ever inserts `(id)` and
-- relies on this column default, so this one ALTER is the whole change —
-- no trigger/function edit needed. Existing users' balances are untouched
-- (a column default only affects new rows going forward).
-- ---------------------------------------------------------------------------
alter table profiles alter column credits set default 1;
