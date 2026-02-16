-- Ensure each user can only have one review per vendor (idempotent).
-- Adds UNIQUE(user_id, vendor_id) if not already present.

DO $$
BEGIN
  ALTER TABLE public.vendor_reviews
  ADD CONSTRAINT vendor_reviews_user_id_vendor_id_key UNIQUE (user_id, vendor_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN SQLSTATE '42P07' THEN NULL;  -- relation "constraint_name" already exists
END $$;

COMMENT ON TABLE public.vendor_reviews IS 'One review per user per vendor; UNIQUE(user_id, vendor_id) enforced.';
