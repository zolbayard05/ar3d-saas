-- ============================================================================
-- 0008_add_bbox_dimensions.sql — real-world dimensions for the feed's metadata line
--
-- The design port's metadata scheme (CLAUDE.md) is "W x D x H CM" per model.
-- Tripo's raw mesh has no real-world scale (rule 22 — that's why models.scale
-- and the scale control exist at all), so the bare glTF bounding box can't be
-- shown as centimeters directly; that would be fabricated precision, not a
-- measurement. What's stored here is the RAW bounding box in the mesh's own
-- (unscaled) units, in meters, from lib/glbCompress.ts's getBounds() call on
-- the already-parsed Document. Display time multiplies by models.scale — the
-- one real, user-controlled number in this whole picture — to get centimeters,
-- so the shown dimensions are honest (traceable to an adjustable value the
-- user set) and update live if they change scale, rather than presenting
-- Tripo's internal normalization as ground truth.
--
-- Nullable: only set once a GLB stage completes and bbox extraction succeeds
-- (best-effort, like the rest of compressGlb's quality passes — a failure
-- here must not fail a paid generation). Rows from before this migration, or
-- where extraction failed, simply have no dimensions to show.
-- ============================================================================

alter table models add column if not exists bbox_width_m real;
alter table models add column if not exists bbox_depth_m real;
alter table models add column if not exists bbox_height_m real;
