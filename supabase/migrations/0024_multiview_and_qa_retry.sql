-- ============================================================================
-- 0024_multiview_and_qa_retry.sql — multi-view generation + QA regen retry
--
-- Multi-view: Tripo's H3 multiview-to-model task takes up to 4 images
-- ([front, left, back, right], front required, >=2 total) and produces
-- meaningfully better geometry on non-symmetric objects than the single-photo
-- image-to-model task we've used exclusively so far (lib/tripo.ts). These
-- three columns are the extra, optional angles — source_image_key (existing)
-- is always "front". All three nullable: most generations still submit only
-- one photo, front-only, exactly as before.
--
-- regen_retry_count: separate counter from size_retry_count (0007) — that one
-- tracks retries for an *oversized* USDZ at a lower face_limit; this tracks
-- retries for a GLB that failed validateGlb's plausibility check (bad
-- geometry/aspect ratio) by resubmitting the SAME inputs at the SAME
-- face_limit, since a generative model's own run-to-run variance means a
-- second attempt sometimes just produces a usable result — see
-- app/api/webhooks/tripo/route.ts. A distinct counter because the two retry
-- loops are bounded independently and can both apply to the same model.
--
-- Rule 36: these are all set once by service_role (the webhook / generation
-- pipeline) and never by a client — no authenticated/anon grant is wanted on
-- any of them, so the revokes below just re-close the gap ALTER TABLE ADD
-- COLUMN reopens by default (rule 36's own lesson), matching 0004/0005/0009.
--
-- All statements idempotent, safe to re-run.
-- ============================================================================

alter table models add column if not exists source_image_key_left text;
alter table models add column if not exists source_image_key_back text;
alter table models add column if not exists source_image_key_right text;
alter table models add column if not exists regen_retry_count int not null default 0;

revoke insert, update on models from authenticated;
revoke insert, update, delete on models from anon;
grant update (title, scale) on models to authenticated;
