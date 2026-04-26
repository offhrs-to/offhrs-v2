-- Verification checks for security baseline on mobile-accessed tables.
-- Fails migration if expected RLS/policies are missing.

DO $$
DECLARE
  missing_count integer;
BEGIN
  SELECT COUNT(*) INTO missing_count
  FROM (
    SELECT relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN (
        'profiles',
        'profile_category_experience',
        'events',
        'vendors',
        'bookings',
        'user_event_saves',
        'vendor_reviews'
      )
      AND c.relkind = 'r'
      AND c.relrowsecurity = false
  ) t;

  IF missing_count > 0 THEN
    RAISE EXCEPTION 'RLS baseline check failed: one or more required tables do not have RLS enabled.';
  END IF;
END $$;

DO $$
DECLARE
  missing_count integer;
BEGIN
  SELECT COUNT(*) INTO missing_count
  FROM (
    SELECT required.policyname, required.tablename
    FROM (
      VALUES
        ('profiles', 'Users can view own profile'),
        ('profiles', 'Users can insert own profile'),
        ('profiles', 'Users can update own profile'),
        ('profile_category_experience', 'Users can view own category experience'),
        ('profile_category_experience', 'Users can insert own category experience'),
        ('profile_category_experience', 'Users can update own category experience'),
        ('profile_category_experience', 'Users can delete own category experience'),
        ('events', 'Allow public read events'),
        ('vendors', 'Anyone can view vendors'),
        ('bookings', 'Users can view own bookings'),
        ('bookings', 'Users can insert own bookings'),
        ('bookings', 'Users can update own bookings'),
        ('user_event_saves', 'Users can view own event saves'),
        ('user_event_saves', 'Users can insert own event saves'),
        ('user_event_saves', 'Users can delete own event saves'),
        ('vendor_reviews', 'Anyone can view reviews'),
        ('vendor_reviews', 'Authenticated users can insert reviews'),
        ('vendor_reviews', 'Users can update own reviews'),
        ('vendor_reviews', 'Users can delete own reviews')
    ) AS required(tablename, policyname)
    LEFT JOIN pg_policies p
      ON p.schemaname = 'public'
      AND p.tablename = required.tablename
      AND p.policyname = required.policyname
    WHERE p.policyname IS NULL
  ) missing;

  IF missing_count > 0 THEN
    RAISE EXCEPTION 'RLS baseline check failed: one or more required policies are missing.';
  END IF;
END $$;
