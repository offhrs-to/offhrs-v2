-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 1: vendor_profiles
-- Core vendor account table for the SaaS booking engine.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vendor_profiles (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                         uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name                   text NOT NULL,
  slug                            text UNIQUE NOT NULL,
  bio                             text,
  website_url                     text,
  phone                           text,
  profile_photo_url               text,
  category                        text[],
  location_address                text,
  -- Subscription lifecycle status
  status                          text NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending','trialing','active','past_due','suspended','canceled')),
  -- Stripe identifiers
  stripe_customer_id              text UNIQUE,
  stripe_account_id               text UNIQUE,
  -- Cal.com managed user identifier
  cal_user_id                     text UNIQUE,
  -- Billing timestamps
  trial_ends_at                   timestamptz,
  subscription_current_period_end timestamptz,
  -- Onboarding checklist flags
  email_verified                  boolean NOT NULL DEFAULT false,
  stripe_checkout_completed       boolean NOT NULL DEFAULT false,
  stripe_connect_completed        boolean NOT NULL DEFAULT false,
  cal_connected                   boolean NOT NULL DEFAULT false,
  first_session_created           boolean NOT NULL DEFAULT false,
  -- Refund policy (hours before session)
  refund_window_hours             integer NOT NULL DEFAULT 48,
  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_vendor_profiles_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_vendor_profiles_updated_at
  BEFORE UPDATE ON vendor_profiles
  FOR EACH ROW EXECUTE FUNCTION update_vendor_profiles_updated_at();

-- RLS
ALTER TABLE vendor_profiles ENABLE ROW LEVEL SECURITY;

-- Vendors can read/update their own profile
CREATE POLICY "vendor_profiles: owner read"
  ON vendor_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "vendor_profiles: owner update"
  ON vendor_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role (backend) can do everything
CREATE POLICY "vendor_profiles: service role all"
  ON vendor_profiles FOR ALL
  USING (auth.role() = 'service_role');

-- Index for slug lookups (used in public vendor pages)
CREATE INDEX idx_vendor_profiles_slug ON vendor_profiles(slug);
CREATE INDEX idx_vendor_profiles_user_id ON vendor_profiles(user_id);
CREATE INDEX idx_vendor_profiles_status ON vendor_profiles(status);
