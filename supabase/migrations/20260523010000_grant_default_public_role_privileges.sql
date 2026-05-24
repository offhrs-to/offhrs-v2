-- ─────────────────────────────────────────────────────────────────────────────
-- Restore default PostgREST grants for anon, authenticated, and service_role.
--
-- New Supabase projects expose three Data API roles (`anon`, `authenticated`,
-- and `service_role`). When the "Automatically expose new tables" project
-- setting is OFF, no table-level grants are added automatically, so even
-- service-role queries from the API admin client return
-- `42501: permission denied for table ...` before RLS ever runs.
--
-- Row-level access is still enforced by the per-table RLS policies created in
-- earlier migrations (e.g. service-role-only tables stay locked down because
-- their policies require `auth.role() = 'service_role'`). These grants only
-- give the Data API a chance to attempt the query at all. `service_role`
-- additionally has BYPASSRLS in Supabase, so once it has table grants it can
-- perform admin operations from server-side routes as designed.
--
-- Idempotent: GRANT and ALTER DEFAULT PRIVILEGES with identical targets are
-- no-ops if already in effect, so this migration is safe to apply to any
-- project that already mirrors Supabase's default exposure (e.g. staging).
-- ─────────────────────────────────────────────────────────────────────────────

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
