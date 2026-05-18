-- Allow consumers (mobile app) to read partner public profile fields for marketplace vendor pages.
DROP POLICY IF EXISTS "vendor_profiles: public marketplace read" ON public.vendor_profiles;

CREATE POLICY "vendor_profiles: public marketplace read"
  ON public.vendor_profiles FOR SELECT
  TO anon, authenticated
  USING (status IN ('trialing', 'active', 'past_due'));
