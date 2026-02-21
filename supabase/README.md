# Supabase Migrations

Run these migrations in your Supabase project:

1. **Option A - Supabase CLI:** `supabase db push` (from project root)
2. **Option B - Supabase Dashboard:** SQL Editor → paste and run each migration file in **order** (oldest first):
   - `20250122000001_create_profiles_and_vendors.sql` (includes `user_vendor_saves`)
   - `20250122000002_backfill_vendors_and_triggers.sql`
   - `20250123000001_sync_organizer_to_vendor.sql`
   - … (all other migrations in timestamp order)
   - **`20250221000001_user_event_saves.sql`** – required for mobile app **Save** button and Profile **Saved** list. Creates `user_event_saves` (event_id, user_id). Without this table, Save does nothing and Profile Saved stays empty.

## Required Supabase Setup

- Enable **Email** and **Google** auth providers in Authentication → Providers
- For Google OAuth: Add your Google Client ID and Secret from Google Cloud Console
