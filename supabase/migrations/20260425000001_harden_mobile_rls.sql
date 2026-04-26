-- Security hardening pass for mobile-accessed tables.
-- Ensures RLS is enabled and required policies exist (idempotent).

-- profiles
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
      AND policyname = 'Users can view own profile'
  ) THEN
    CREATE POLICY "Users can view own profile"
      ON public.profiles FOR SELECT
      TO authenticated
      USING (auth.uid() = id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
      AND policyname = 'Users can insert own profile'
  ) THEN
    CREATE POLICY "Users can insert own profile"
      ON public.profiles FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
      AND policyname = 'Users can update own profile'
  ) THEN
    CREATE POLICY "Users can update own profile"
      ON public.profiles FOR UPDATE
      TO authenticated
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- profile_category_experience
ALTER TABLE IF EXISTS public.profile_category_experience ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profile_category_experience'
      AND policyname = 'Users can view own category experience'
  ) THEN
    CREATE POLICY "Users can view own category experience"
      ON public.profile_category_experience FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profile_category_experience'
      AND policyname = 'Users can insert own category experience'
  ) THEN
    CREATE POLICY "Users can insert own category experience"
      ON public.profile_category_experience FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profile_category_experience'
      AND policyname = 'Users can update own category experience'
  ) THEN
    CREATE POLICY "Users can update own category experience"
      ON public.profile_category_experience FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profile_category_experience'
      AND policyname = 'Users can delete own category experience'
  ) THEN
    CREATE POLICY "Users can delete own category experience"
      ON public.profile_category_experience FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- events: public read
ALTER TABLE IF EXISTS public.events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'events'
      AND policyname = 'Allow public read events'
  ) THEN
    CREATE POLICY "Allow public read events"
      ON public.events FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END $$;

-- vendors: public read
ALTER TABLE IF EXISTS public.vendors ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'vendors'
      AND policyname = 'Anyone can view vendors'
  ) THEN
    CREATE POLICY "Anyone can view vendors"
      ON public.vendors FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END $$;

-- bookings
ALTER TABLE IF EXISTS public.bookings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bookings'
      AND policyname = 'Users can view own bookings'
  ) THEN
    CREATE POLICY "Users can view own bookings"
      ON public.bookings FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bookings'
      AND policyname = 'Users can insert own bookings'
  ) THEN
    CREATE POLICY "Users can insert own bookings"
      ON public.bookings FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bookings'
      AND policyname = 'Users can update own bookings'
  ) THEN
    CREATE POLICY "Users can update own bookings"
      ON public.bookings FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bookings'
      AND policyname = 'Users can delete own bookings'
  ) THEN
    CREATE POLICY "Users can delete own bookings"
      ON public.bookings FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- user_event_saves
ALTER TABLE IF EXISTS public.user_event_saves ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_event_saves'
      AND policyname = 'Users can view own event saves'
  ) THEN
    CREATE POLICY "Users can view own event saves"
      ON public.user_event_saves FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_event_saves'
      AND policyname = 'Users can insert own event saves'
  ) THEN
    CREATE POLICY "Users can insert own event saves"
      ON public.user_event_saves FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_event_saves'
      AND policyname = 'Users can delete own event saves'
  ) THEN
    CREATE POLICY "Users can delete own event saves"
      ON public.user_event_saves FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- vendor_reviews
ALTER TABLE IF EXISTS public.vendor_reviews ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'vendor_reviews'
      AND policyname = 'Anyone can view reviews'
  ) THEN
    CREATE POLICY "Anyone can view reviews"
      ON public.vendor_reviews FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'vendor_reviews'
      AND policyname = 'Authenticated users can insert reviews'
  ) THEN
    CREATE POLICY "Authenticated users can insert reviews"
      ON public.vendor_reviews FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'vendor_reviews'
      AND policyname = 'Users can update own reviews'
  ) THEN
    CREATE POLICY "Users can update own reviews"
      ON public.vendor_reviews FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'vendor_reviews'
      AND policyname = 'Users can delete own reviews'
  ) THEN
    CREATE POLICY "Users can delete own reviews"
      ON public.vendor_reviews FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;
