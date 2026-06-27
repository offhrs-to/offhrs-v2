-- ─────────────────────────────────────────────────────────────────────────────
-- Delete admin/manual workshop listings for one partner vendor
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Use when a partner has onboarded and published their own workshops in the
-- partner dashboard, and you want to remove YOUR legacy manual listings for
-- them without touching anything they created.
--
-- How we tell them apart:
--   • Partner dashboard sessions ALWAYS set `price_cad` (including free = 0).
--   • Admin → Add Event listings leave `price_cad` NULL (legacy `price` text only).
--
-- Scope (workshops tied to this vendor):
--   • `vendor_profile_id` matches the partner, OR
--   • legacy `vendor_id` / `organizer` matches their business name.
--
-- Run in Supabase SQL Editor. ALWAYS run step 1 (preview) before step 2 (delete).
-- ─────────────────────────────────────────────────────────────────────────────


-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 0 — Find the partner (run once if you need their UUID)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- SELECT id, business_name, slug, status
-- FROM vendor_profiles
-- WHERE business_name ILIKE '%zei pottery%'
--    OR slug ILIKE '%zei%';


-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 1 — PREVIEW rows that would be deleted (safe; read-only)
-- ═══════════════════════════════════════════════════════════════════════════
-- Replace the UUID below with the partner's vendor_profiles.id

WITH params AS (
  SELECT '00000000-0000-0000-0000-000000000000'::uuid AS vendor_profile_id
),
target AS (
  SELECT
    vp.id AS vendor_profile_id,
    trim(vp.business_name) AS business_name,
    v.id AS legacy_vendor_id
  FROM vendor_profiles vp
  CROSS JOIN params p
  LEFT JOIN vendors v
    ON trim(lower(v.name)) = trim(lower(vp.business_name))
  WHERE vp.id = p.vendor_profile_id
),
manual_for_vendor AS (
  SELECT
    e.id,
    e.title,
    e.date,
    e.location,
    e.organizer,
    e.price,
    e.price_cad,
    e.external_link,
    e.vendor_id,
    e.vendor_profile_id,
    e.booking_status,
    e.created_at,
    CASE
      WHEN e.vendor_profile_id = t.vendor_profile_id THEN 'vendor_profile_id'
      WHEN e.vendor_id IS NOT NULL AND e.vendor_id = t.legacy_vendor_id THEN 'legacy vendor_id'
      WHEN trim(lower(coalesce(e.organizer, ''))) = trim(lower(t.business_name)) THEN 'organizer name'
      ELSE 'other'
    END AS match_reason
  FROM events e
  CROSS JOIN target t
  WHERE e.price_cad IS NULL
    AND (
      e.vendor_profile_id = t.vendor_profile_id
      OR (t.legacy_vendor_id IS NOT NULL AND e.vendor_id = t.legacy_vendor_id)
      OR (
        e.vendor_profile_id IS NULL
        AND trim(lower(coalesce(e.organizer, ''))) = trim(lower(t.business_name))
      )
    )
)
SELECT *
FROM manual_for_vendor
ORDER BY date NULLS LAST, id;


-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 1b — Sanity check: partner-created workshops (these are KEPT)
-- ═══════════════════════════════════════════════════════════════════════════
-- Uncomment to confirm their live listings are excluded from the delete.

-- WITH params AS (
--   SELECT '00000000-0000-0000-0000-000000000000'::uuid AS vendor_profile_id
-- )
-- SELECT e.id, e.title, e.date, e.price_cad, e.booking_status, e.location
-- FROM events e
-- JOIN params p ON e.vendor_profile_id = p.vendor_profile_id
-- WHERE e.price_cad IS NOT NULL
-- ORDER BY e.date NULLS LAST;


-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 2 — DELETE (only after preview looks correct)
-- ═══════════════════════════════════════════════════════════════════════════
-- Replace the UUID, then run. First run ends with ROLLBACK (no permanent change).
-- When the preview count matches, change ROLLBACK to COMMIT.

/*
BEGIN;

WITH params AS (
  SELECT '00000000-0000-0000-0000-000000000000'::uuid AS vendor_profile_id
),
target AS (
  SELECT
    vp.id AS vendor_profile_id,
    trim(vp.business_name) AS business_name,
    v.id AS legacy_vendor_id
  FROM vendor_profiles vp
  CROSS JOIN params p
  LEFT JOIN vendors v
    ON trim(lower(v.name)) = trim(lower(vp.business_name))
  WHERE vp.id = p.vendor_profile_id
),
to_delete AS (
  SELECT e.id
  FROM events e
  CROSS JOIN target t
  WHERE e.price_cad IS NULL
    AND (
      e.vendor_profile_id = t.vendor_profile_id
      OR (t.legacy_vendor_id IS NOT NULL AND e.vendor_id = t.legacy_vendor_id)
      OR (
        e.vendor_profile_id IS NULL
        AND trim(lower(coalesce(e.organizer, ''))) = trim(lower(t.business_name))
      )
    )
)
DELETE FROM events e
USING to_delete d
WHERE e.id = d.id;

ROLLBACK;
-- COMMIT;
*/
