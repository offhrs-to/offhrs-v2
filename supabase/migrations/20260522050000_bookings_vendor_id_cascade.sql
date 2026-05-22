-- bookings.vendor_id originally references vendor_profiles(id) with NO ACTION,
-- which blocked deleting a vendor while customer booking rows still pointed at
-- the vendor (even when the related events would have cascaded). Switch the FK
-- to ON DELETE CASCADE so vendor deletion clears those booking rows
-- atomically, and so the application code's explicit cleanup is a no-op rather
-- than a hard prerequisite. The application still refunds active paid
-- bookings via Stripe before the delete; this constraint only governs the
-- final database cleanup.

DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT con.conname
    INTO fk_name
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
   WHERE nsp.nspname = 'public'
     AND rel.relname = 'bookings'
     AND con.contype = 'f'
     AND con.conkey @> ARRAY[(
       SELECT attnum
         FROM pg_attribute
        WHERE attrelid = rel.oid
          AND attname = 'vendor_id'
     )::int2];

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.bookings DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_vendor_id_fkey
  FOREIGN KEY (vendor_id)
  REFERENCES public.vendor_profiles(id)
  ON DELETE CASCADE;
