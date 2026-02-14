-- Ensure events have lat/lng columns (if table was created without them)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'lat') THEN
    ALTER TABLE public.events ADD COLUMN lat DOUBLE PRECISION;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'lng') THEN
    ALTER TABLE public.events ADD COLUMN lng DOUBLE PRECISION;
  END IF;
END $$;

-- Backfill events with null lat/lng so they appear on the map (Toronto center with small offset per event so they don't stack)
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
