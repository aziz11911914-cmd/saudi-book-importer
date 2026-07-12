
-- =========================================================================
-- 1) Lock down platform_settings so no anon/authenticated row is exposed.
--    The maintenance flag is served via the security-definer view below.
-- =========================================================================

-- Drop any remaining public/anon-facing SELECT policies on the raw table.
DROP POLICY IF EXISTS "Public can read maintenance flag" ON public.platform_settings;
DROP POLICY IF EXISTS "Anyone signed-in can read maintenance status via view" ON public.platform_settings;
DROP POLICY IF EXISTS "Anyone can read maintenance singleton" ON public.platform_settings;
DROP POLICY IF EXISTS "Anyone may read settings" ON public.platform_settings;
DROP POLICY IF EXISTS "Authenticated users read settings" ON public.platform_settings;
DROP POLICY IF EXISTS "Authenticated users read maintenance only" ON public.platform_settings;

-- Revoke all direct SELECT (including any column grants) from anon/authenticated.
REVOKE ALL ON public.platform_settings FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.platform_settings TO service_role;
GRANT SELECT, UPDATE ON public.platform_settings TO postgres;

-- Admins may still read/update via the existing admin policies + admin grants.
GRANT SELECT, UPDATE ON public.platform_settings TO authenticated;
-- ...but only the "Admins read all settings columns" / "Super admin updates settings"
-- policies actually allow the row to be visible; RLS blocks non-admins.

-- Recreate maintenance view as SECURITY DEFINER (invoker=off) so anon/auth
-- can read only the maintenance flag without SELECT on the underlying table.
DROP VIEW IF EXISTS public.maintenance_status_v;
CREATE VIEW public.maintenance_status_v
WITH (security_invoker = off)
AS SELECT maintenance FROM public.platform_settings WHERE id = 1;

ALTER VIEW public.maintenance_status_v OWNER TO postgres;
GRANT SELECT ON public.maintenance_status_v TO anon, authenticated;

-- =========================================================================
-- 2) Revoke EXECUTE on internal SECURITY DEFINER functions from anon/auth.
--    These are trigger bodies or server-only helpers; the client never
--    calls them directly. RLS-facing functions (has_role, is_super_admin)
--    stay executable so policies keep working.
-- =========================================================================

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.protect_super_admin_role() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ensure_protected_super_admin(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_unique_shop_slug(text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.accept_invite(uuid, text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.activate_invitation_code(text, uuid, text, text, text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consume_invites_for_user(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_maintenance_status() FROM anon, authenticated, PUBLIC;

-- service_role continues to execute everything (default), so server functions
-- calling these RPCs via supabaseAdmin are unaffected.
GRANT EXECUTE ON FUNCTION public.accept_invite(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.activate_invitation_code(text, uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_invites_for_user(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_unique_shop_slug(text) TO service_role;
