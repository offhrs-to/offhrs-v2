-- Let signed-in users read SaaS bookings tied to their email when user_id was not set at insert time.
DROP POLICY IF EXISTS "Users can view own bookings" ON public.bookings;

CREATE POLICY "Users can view own bookings"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR (
      email IS NOT NULL
      AND lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

-- Backfill user_id on bookings that match the attendee email to an auth account.
UPDATE public.bookings b
SET user_id = u.id
FROM auth.users u
WHERE b.user_id IS NULL
  AND b.email IS NOT NULL
  AND lower(b.email) = lower(u.email);
