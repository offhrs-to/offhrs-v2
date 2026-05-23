-- Default workshop logo per vendor + per-event cover image + public storage bucket.

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS default_workshop_image_url text;

COMMENT ON COLUMN public.vendor_profiles.default_workshop_image_url IS
  'Public URL for default workshop/event listing image when a session has no custom cover.';

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS image_url text;

COMMENT ON COLUMN public.events.image_url IS
  'Cover image URL for workshop listings; falls back to vendor default_workshop_image_url then category art in UI.';

-- ── Storage: vendor workshop images (public read; uploads via service role from API) ──
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('vendor-workshop-images', 'vendor-workshop-images', true, 2621440)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "vendor_workshop_images_public_read" ON storage.objects;
CREATE POLICY "vendor_workshop_images_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'vendor-workshop-images');
