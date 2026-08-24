-- ============================================================================
-- 0012_add_source_image_dimensions.sql
--
-- MasonryGrid was assigning columns by a hash of the model's own id, then
-- balancing purely by luck of the hash — it had no way to know how tall a
-- card would actually render (that depends on the source photo's own pixel
-- aspect ratio, which nothing stored anywhere). Storing it at upload time
-- lets the grid compute expected height per card and pack columns by that,
-- instead of measuring after render.
--
-- Nullable, no default: legacy rows (everything before this migration)
-- simply don't have it — MasonryGrid falls back to a neutral assumed ratio
-- for those specifically, same "graceful degradation for pre-migration
-- rows" pattern as bbox_width_m/etc in 0008.
-- ============================================================================

alter table models add column if not exists source_image_width int;
alter table models add column if not exists source_image_height int;

-- No grant changes needed: set once at insert time via the service-role
-- client in app/api/generate/route.ts, same as bbox_*/scale/status — never
-- user-writable, so it doesn't touch the authenticated column allowlist
-- from migration 0004.
