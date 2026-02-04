-- Sync events.organizer to vendors and set events.vendor_id whenever organizer is set or changed.
-- Runs as SECURITY DEFINER so it can INSERT into vendors (RLS only allows SELECT for public).

CREATE OR REPLACE FUNCTION public.sync_event_organizer_to_vendor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor_id UUID;
  v_slug TEXT;
  v_name TEXT;
BEGIN
  v_name := trim(COALESCE(NEW.organizer, ''));
  IF v_name = '' THEN
    NEW.vendor_id := NULL;
    RETURN NEW;
  END IF;

  v_slug := lower(regexp_replace(regexp_replace(v_name, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'));
  IF v_slug = '' OR v_slug IS NULL THEN
    v_slug := v_name;
  END IF;

  -- Try to get or create vendor by name; if slug conflict, use existing vendor with same slug/name
  BEGIN
    INSERT INTO public.vendors (name, slug)
    VALUES (v_name, v_slug)
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_vendor_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_vendor_id FROM public.vendors WHERE name = v_name OR slug = v_slug LIMIT 1;
    IF v_vendor_id IS NULL THEN
      RAISE;
    END IF;
  END;

  NEW.vendor_id := v_vendor_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_organizer_to_vendor_on_events ON public.events;
CREATE TRIGGER sync_organizer_to_vendor_on_events
  BEFORE INSERT OR UPDATE OF organizer
  ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_event_organizer_to_vendor();

-- Backfill: set vendor_id for existing events that have organizer but no vendor_id
UPDATE public.events e
SET vendor_id = v.id
FROM public.vendors v
WHERE e.organizer IS NOT NULL AND trim(e.organizer) != ''
  AND e.vendor_id IS NULL
  AND trim(e.organizer) = v.name;

-- Ensure vendors exist for any organizer not yet in vendors, then link (handles existing rows added before trigger)
INSERT INTO public.vendors (name, slug)
SELECT DISTINCT trim(e.organizer),
  COALESCE(
    NULLIF(trim(lower(regexp_replace(regexp_replace(trim(e.organizer), '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'))), ''),
    trim(e.organizer)
  )
FROM public.events e
WHERE e.organizer IS NOT NULL AND trim(e.organizer) != ''
ON CONFLICT (name) DO NOTHING;

UPDATE public.events e
SET vendor_id = v.id
FROM public.vendors v
WHERE e.organizer IS NOT NULL AND trim(e.organizer) != ''
  AND e.vendor_id IS NULL
  AND trim(e.organizer) = v.name;
