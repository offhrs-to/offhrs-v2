-- Normalize auth.users.email to lowercase so one email (any case) maps to one account.
-- This prevents duplicate accounts when the same person signs in with Google multiple times
-- (e.g. Ericshminn@gmail.com vs ericshminn@gmail.com). Supabase's automatic identity
-- linking can then match existing users when the same email is used again.

CREATE OR REPLACE FUNCTION public.normalize_auth_user_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NOT NULL AND TRIM(NEW.email) != '' THEN
    NEW.email := LOWER(TRIM(NEW.email));
  END IF;
  RETURN NEW;
END;
$$;

-- Only auth and service role may run this trigger
GRANT EXECUTE ON FUNCTION public.normalize_auth_user_email() TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.normalize_auth_user_email() TO service_role;
REVOKE EXECUTE ON FUNCTION public.normalize_auth_user_email() FROM anon, authenticated, public;

DROP TRIGGER IF EXISTS normalize_auth_user_email_trigger ON auth.users;
CREATE TRIGGER normalize_auth_user_email_trigger
  BEFORE INSERT OR UPDATE OF email
  ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_auth_user_email();

COMMENT ON FUNCTION public.normalize_auth_user_email() IS 'Ensures auth.users.email is stored lowercase so duplicate sign-ups with same email (different case) are prevented by the unique constraint.';
