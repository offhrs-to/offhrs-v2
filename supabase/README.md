# Supabase Migrations

Run these migrations in your Supabase project:

1. **Option A - Supabase CLI:** `supabase db push` (from project root)
2. **Option B - Supabase Dashboard:** SQL Editor → paste and run each migration file in order:
   - `20250122000001_create_profiles_and_vendors.sql`
   - `20250122000002_backfill_vendors_and_triggers.sql`

## Required Supabase Setup

- Enable **Email** and **Google** auth providers in Authentication → Providers
- For Google OAuth: Add your Google Client ID and Secret from Google Cloud Console
