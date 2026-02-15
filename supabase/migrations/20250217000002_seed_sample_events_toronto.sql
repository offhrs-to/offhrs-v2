-- Seed sample workshops in Toronto so the mobile map view has events to show.
-- Coordinates: 207 Queen St E area (43.6526, -79.3710) and nearby.
-- Uses future dates so they appear in the app (workshops tab filters to future events only).

-- Only seed when there are no events (avoid duplicates on re-run).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'events')
     AND (SELECT COUNT(*) FROM public.events) = 0
  THEN
    INSERT INTO public.events (
      title,
      date,
      location,
      category,
      lat,
      lng,
      organizer,
      price,
      external_link,
      is_multiple_dates
    ) VALUES
      (
        'Introduction to Pottery',
        (CURRENT_DATE + INTERVAL '14 days')::timestamptz,
        '207 Queen St East, Toronto, ON M5A 1S2',
        'Pottery',
        43.6526,
        -79.3710,
        'Offhrs Studio',
        '45',
        NULL,
        false
      ),
      (
        'Coffee Roasting Basics',
        (CURRENT_DATE + INTERVAL '21 days')::timestamptz,
        'Downtown Toronto',
        'Coffee',
        43.6532,
        -79.3832,
        'Offhrs Studio',
        '35',
        NULL,
        false
      ),
      (
        'Floral Arrangement Workshop',
        (CURRENT_DATE + INTERVAL '7 days')::timestamptz,
        'Queen St West, Toronto',
        'Floral',
        43.6448,
        -79.4012,
        'Offhrs Studio',
        '55',
        NULL,
        false
      ),
      (
        'Culinary Skills: Knife & Sauces',
        (CURRENT_DATE + INTERVAL '28 days')::timestamptz,
        'Toronto',
        'Culinary',
        43.6562,
        -79.3628,
        'Offhrs Studio',
        '65',
        NULL,
        false
      );
  END IF;
END $$;

-- Ensure any existing events (including the ones we may have just inserted without id conflict) have lat/lng.
-- Re-run the same backfill logic for events that still have null coords.
WITH numbered AS (
  SELECT id, row_number() OVER (ORDER BY id) AS rn
  FROM public.events
  WHERE lat IS NULL OR lng IS NULL
)
UPDATE public.events e
SET
  lat = 43.6532 + 0.004 * ((n.rn - 1) % 5),
  lng = -79.3832 + 0.004 * ((n.rn - 1) / 5)
FROM numbered n
WHERE e.id = n.id;
