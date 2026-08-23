-- ============================================================================
-- 0007_add_size_retry_tracking.sql — track USDZ size-budget retries
--
-- USDZ can't be Draco-compressed (KHR_draco_mesh_compression is a glTF-only
-- extension; ARKit's format has no equivalent), so its size is driven
-- entirely by geometry complexity at generation time (face_limit). One
-- measured chair came out under rule 21's 8 MB target, but nothing enforces
-- that for other object types — a dense lattice or foliage could exceed it
-- at the same face_limit. This column tracks how many times a model's
-- generation was retried at a reduced face_limit (see
-- app/api/webhooks/tripo/route.ts) to hit budget, so results across the
-- showcase batch inform what face_limit should actually default to, rather
-- than the single current guess (DEFAULT_FACE_LIMIT in lib/tripo.ts).
--
-- Idempotent, safe to re-run.
-- ============================================================================

alter table models add column if not exists size_retry_count int not null default 0;
