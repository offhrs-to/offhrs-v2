-- Allow vendor_profiles (and auth user cascade) to delete when sessions still exist:
-- remove/replace the default NO ACTION FK on events.vendor_profile_id.
ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_vendor_profile_id_fkey;

ALTER TABLE public.events
  ADD CONSTRAINT events_vendor_profile_id_fkey
  FOREIGN KEY (vendor_profile_id)
  REFERENCES public.vendor_profiles(id)
  ON DELETE CASCADE;
