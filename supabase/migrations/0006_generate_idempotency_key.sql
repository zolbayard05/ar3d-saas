-- ============================================================================
-- 0006_generate_idempotency_key.sql — close the double-submit revenue hole
--
-- /api/generate deducts a credit and creates a models row per call, with no
-- way to tell "the client retried the same request" apart from "the user
-- asked for a second generation" — a lost response (network blip) or a
-- double-click either double-charges or, worse under true concurrency,
-- races two credit deductions through before either insert lands.
--
-- The client now generates one UUID per submit *attempt* (not per request —
-- a retry of the same attempt must reuse the same key) and sends it as
-- idempotency_key. The unique constraint is the actual enforcement
-- mechanism: two inserts for the same (user_id, idempotency_key) can't both
-- succeed, so a genuine concurrent double-fire is caught at the database
-- level, not just by an application-level check-then-act that would itself
-- be racy.
--
-- Nullable: rows created outside /api/generate (scripts/seed-test-model.mjs,
-- any future service_role-only insert path) don't need one — a unique index
-- allows any number of NULLs in Postgres, so this doesn't force every
-- insert path to invent a key.
-- ============================================================================

alter table models add column if not exists idempotency_key uuid;
create unique index if not exists models_user_idempotency_key_unique on models (user_id, idempotency_key);
