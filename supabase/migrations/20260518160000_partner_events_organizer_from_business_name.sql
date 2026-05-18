-- Partner workshops: set organizer from vendor_profiles.business_name so mobile + vendor_id sync work.
UPDATE public.events e
SET organizer = vp.business_name
FROM public.vendor_profiles vp
WHERE e.vendor_profile_id = vp.id
  AND vp.business_name IS NOT NULL
  AND trim(vp.business_name) <> ''
  AND (e.organizer IS NULL OR trim(e.organizer) = '');
