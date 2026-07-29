-- ─────────────────────────────────────────────────────────────────────────────
-- Security hardening: restrict vendor_profiles columns visible to anon/authenticated
--
-- vendor_profiles has RLS policies scoping SELECT to either the owning vendor
-- (auth.uid() = user_id) or any active/trialing/past_due vendor for the public
-- marketplace ("vendor_profiles: public marketplace read"). RLS is row-level
-- only — the table-wide `GRANT ALL` applied in
-- 20260523010000_grant_default_public_role_privileges.sql means any caller
-- covered by those policies (including any signed-in consumer, or literally
-- anyone with the public anon key) can currently request `select=*` directly
-- against the Data API and receive every column, including
-- stripe_customer_id, stripe_account_id, gst_hst_registration_number, and
-- phone — even though the app itself never requests those columns from a
-- public/marketplace context.
--
-- This migration narrows anon/authenticated SELECT to the columns the app
-- actually uses publicly. service_role is untouched (it bypasses RLS and
-- keeps its own ALL-privilege grant) and INSERT/UPDATE/DELETE grants are
-- untouched, since app writes to this table always go through the
-- service-role client server-side.
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE SELECT ON public.vendor_profiles FROM anon, authenticated;

-- user_id is included because the "owner read"/"owner update" RLS policies
-- reference it in their USING clause (auth.uid() = user_id); Postgres
-- requires column-level SELECT on any column referenced by a policy
-- predicate, even for roles that only match a different policy.
GRANT SELECT (
  id,
  user_id,
  business_name,
  slug,
  bio,
  website_url,
  instagram_handle,
  category,
  location_address,
  location_lat,
  location_lng,
  default_workshop_image_url,
  refund_window_hours,
  strict_no_refund,
  status,
  first_session_created,
  created_at
) ON public.vendor_profiles TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
