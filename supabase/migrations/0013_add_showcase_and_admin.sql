-- ============================================================================
-- 0013_add_showcase_and_admin.sql
--
-- Public showcase feed: models.is_showcase marks a model as visible in the
-- public feed to every visitor, signed in or not. profiles.is_admin marks
-- who is allowed to curate that flag at all.
--
-- Neither column gets ANY client grant — not even for an admin. Rule 33/35/36
-- class of bug, hit three times already in this project (UPDATE grants,
-- INSERT grants, then anon specifically): RLS restricts ROWS, a row-owner
-- policy says nothing about which COLUMNS that owner may set, and a user who
-- can update their own row can set every column in it unless a column-level
-- grant stops them. is_showcase/is_admin are both curated exclusively by a
-- service-role script (scripts/flag-showcase-models.mjs, and this migration
-- itself for the one-time is_admin grant below) — there is no
-- authenticated-facing path that touches them at all, by design, not just by
-- omission. The explicit revokes below aren't strictly required (Supabase's
-- default column grants for `authenticated`/`anon` on this project's tables
-- only ever auto-extend to SELECT/INSERT/REFERENCES on a new column, never
-- UPDATE — confirmed via information_schema before writing this — and
-- `authenticated` has no INSERT grant on `models` at all since 0005, and no
-- INSERT *policy* on `profiles` since 0001), but explicit beats "confirmed
-- to currently be absent" for exactly the reason rule 36 exists: a default
-- can change, an explicit revoke can't silently stop applying.
-- ============================================================================

alter table models add column if not exists is_showcase boolean not null default false;
alter table profiles add column if not exists is_admin boolean not null default false;

revoke update (is_showcase), insert (is_showcase) on models from authenticated;
revoke update (is_showcase), insert (is_showcase) on models from anon;

revoke update (is_admin), insert (is_admin) on profiles from authenticated;
revoke update (is_admin), insert (is_admin) on profiles from anon;

-- SELECT stays granted (Supabase's default, unrevoked) on both new columns:
-- is_showcase must be readable by anon/authenticated for the feed query
-- itself to filter on it; is_admin readable is harmless (a user seeing
-- their own is_admin: false/true via the existing owner-only profiles
-- select policy isn't a privilege escalation, just a fact about their own
-- row) and lets a future admin-only UI element decide whether to render
-- without a separate round trip.

-- One-time, not a general admin-management mechanism: the only account this
-- project has ever needed elevated. Any future admin grant is the same
-- one-line update, run the same way — through the SQL editor/migration, by
-- someone who already has database access, never through the app.
update profiles set is_admin = true
where id = (select id from auth.users where email = 'zolbayar.d05@gmail.com');
