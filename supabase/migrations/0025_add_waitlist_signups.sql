-- ============================================================================
-- 0025_add_waitlist_signups.sql — public email capture for the landing
-- page's "Chrome-д нэмэх" CTA while the Chrome Web Store listing isn't
-- published yet.
--
-- Same RLS/grant shape as 0018_add_api_tokens.sql, adapted for a public
-- (not user-owned) table: anyone may INSERT (that's the whole point — an
-- anonymous visitor submitting an email), but nobody client-side may
-- SELECT/UPDATE/DELETE. A public insert grant must never carry an implicit
-- read/tamper grant on other people's rows (rule 33/35/36's principle,
-- applied here even though this table has no user_id/ownership concept at
-- all). service_role (a future admin export) is the only reader.
-- ============================================================================

create table if not exists waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text not null default 'landing',
  created_at timestamptz not null default now()
);

-- Case-insensitive de-dupe: resubmitting the same email (e.g. clicking
-- "Chrome-д нэмэх" in both nav and hero) is a conflict, not two rows.
create unique index if not exists waitlist_signups_email_lower_idx
  on waitlist_signups (lower(email));

alter table waitlist_signups enable row level security;

drop policy if exists "waitlist_signups: anyone can insert" on waitlist_signups;
create policy "waitlist_signups: anyone can insert" on waitlist_signups
  for insert
  with check (true);

revoke select, update, delete on waitlist_signups from anon, authenticated;
grant insert (email, source) on waitlist_signups to anon, authenticated;
