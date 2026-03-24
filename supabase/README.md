# Supabase Migrations

Run these migrations in your Supabase project:

1. **Option A - Supabase CLI:** `npx supabase db push` (from project root; requires `supabase link` first).
2. **Option B - Supabase Dashboard:** SQL Editor → paste and run each migration file in **order** (oldest first):
   - `20250122000001_create_profiles_and_vendors.sql` (includes `user_vendor_saves`)
   - `20250122000002_backfill_vendors_and_triggers.sql`
   - `20250123000001_sync_organizer_to_vendor.sql`
   - `20250206000001_default_novice_for_profiles.sql`
   - `20250206000002_add_instructor_categories.sql`
   - `20250215000001_sync_profile_from_auth_metadata.sql`
   - `20250216000001_backfill_event_coordinates.sql`
   - `20250217000001_profile_category_experience.sql`
   - `20250217000002_seed_sample_events_toronto.sql`
   - `20250217000003_normalize_auth_user_email.sql`
   - `20250217000004_events_public_read_and_map_seed.sql`
   - `20250218000001_ensure_profiles_instructor_categories.sql`
   - `20250218000002_ensure_profile_category_experience.sql`
   - `20250219000001_fix_profile_category_experience_schema.sql`
   - `20250220000001_ensure_vendor_reviews_one_per_user.sql`
   - **`20250221000001_user_event_saves.sql`** – required for mobile app **Save** button and Profile **Saved** list.
   - `20250222000001_event_redirects.sql`
   - `20250223000001_daily_visits.sql`
   - **`20250224000001_add_events_duration_weeks.sql`** – adds `events.duration_weeks` for XP-by-workshop-weeks (requires `events` table to exist).
   - `20250225000001_booking_confirmation_email_sent.sql`
   - **`20250324000001_remove_music_wellness_categories.sql`** – removes Music/Wellness from stored data (events → Other; profile rows cleaned).

## Troubleshooting: "db push did not migrate all the changes"

1. **Check what’s applied vs pending**
   - From project root: `npx supabase migration list`
   - This shows LOCAL vs REMOTE; migrations only in LOCAL are pending and will run on the next `db push`.

2. **If some migrations were skipped or the remote is out of sync**
   - Run `npx supabase db push` again. Already-applied migrations are skipped (tracked in `supabase_migrations.schema_migrations`).
   - If a migration is marked applied on remote but the schema change never ran (e.g. `events` didn’t exist when `20250224000001` ran), you can:
     - **Option A:** In Supabase Dashboard → SQL Editor, run the migration SQL by hand (e.g. paste contents of `20250224000001_add_events_duration_weeks.sql`). It’s idempotent (safe to run again).
     - **Option B:** Mark the migration as reverted then push again:  
       `npx supabase migration repair 20250224000001 --status reverted`  
       then `npx supabase db push`.

3. **If `events` table doesn’t exist**
   - The `events` table is not created in these repo migrations (it may exist from Dashboard or another source). The migration `20250224000001_add_events_duration_weeks.sql` only runs when `events` exists. If you need `duration_weeks` and already have `events`, run that migration’s SQL manually in the SQL Editor.

## Required Supabase Setup

- Enable **Email** and **Google** auth providers in Authentication → Providers
- For Google OAuth: Add your Google Client ID and Secret from Google Cloud Console

## Recurring workshop instances (materialized rows)

Events saved as **daily** or **weekly** renewal in the admin UI are stored as multiple dated rows (4 weeks of weekly or 28 days of daily), each with `recurrence = 'none'`.

**Older data** may still have a single row with `recurrence` set to `daily` or `weekly`. To expand those into the same concrete instances without re-entering them:

1. Set `SUPABASE_SERVICE_ROLE_KEY` in the web app environment (required for the admin API).
2. In **Admin Dashboard** → **Backfill recurring instances** (after logging in).

The operation is **idempotent**: it only selects rows where `recurrence` is `daily` or `weekly`, inserts the extra dated copies, then sets the original row’s `recurrence` to `none`.
