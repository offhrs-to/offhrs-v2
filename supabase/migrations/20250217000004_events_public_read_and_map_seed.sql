-- 1) Ensure events table is readable by the app (anon/authenticated).
--    If RLS is enabled and no policy exists, the app gets zero rows and the map is empty.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'events') THEN
    ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  CREATE POLICY "Allow public read events"
    ON public.events FOR SELECT TO anon, authenticated USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;

-- 2) If there are no future events with coordinates, insert sample Toronto events so the map has pins.
DO $$
DECLARE
  future_with_coords int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'events') THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO future_with_coords
  FROM public.events
  WHERE (date IS NULL OR date > NOW())
    AND lat IS NOT NULL AND lng IS NOT NULL;

  IF future_with_coords = 0 THEN
    INSERT INTO public.events (
      title, date, location, category, lat, lng, organizer, price, external_link, is_multiple_dates
    ) VALUES
      (
        'Introduction to Pottery',
        (CURRENT_DATE + INTERVAL '14 days')::timestamptz,
        '207 Queen St East, Toronto, ON M5A 1S2',
        'Pottery', 43.6526, -79.3710, 'Offhrs Studio', '45', NULL, false
      ),
      (
        'Coffee Roasting Basics',
        (CURRENT_DATE + INTERVAL '21 days')::timestamptz,
        'Downtown Toronto',
        'Coffee', 43.6532, -79.3832, 'Offhrs Studio', '35', NULL, false
      ),
      (
        'Floral Arrangement Workshop',
        (CURRENT_DATE + INTERVAL '7 days')::timestamptz,
        'Queen St West, Toronto',
        'Floral', 43.6448, -79.4012, 'Offhrs Studio', '55', NULL, false
      ),
      (
        'Culinary Skills: Knife & Sauces',
        (CURRENT_DATE + INTERVAL '28 days')::timestamptz,
        'Toronto',
        'Culinary', 43.6562, -79.3628, 'Offhrs Studio', '65', NULL, false
      );
  END IF;
END $$;

-- 3) Backfill lat/lng for any events that still have null (idempotent).
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
