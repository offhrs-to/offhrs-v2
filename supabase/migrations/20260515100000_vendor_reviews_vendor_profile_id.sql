-- Link vendor reviews to SaaS vendor_profiles so partners can match clients (by user_id) to reviews.
ALTER TABLE public.vendor_reviews
  ADD COLUMN IF NOT EXISTS vendor_profile_id uuid REFERENCES public.vendor_profiles(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_vendor_reviews_vendor_profile_id
  ON public.vendor_reviews (vendor_profile_id);

COMMENT ON COLUMN public.vendor_reviews.vendor_profile_id IS
  'When set, this review is for a partner (vendor_profiles) listing; legacy vendor_id may still be set for older rows.';
