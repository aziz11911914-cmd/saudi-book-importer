
-- 1. search_path fixes on pgmq wrapper functions
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = '';
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = '';
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = '';
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = '';

-- 2. Lock down SECURITY DEFINER functions: revoke from PUBLIC, grant only where necessary
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_super_admin_role() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_protected_super_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_unique_shop_slug(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.email_queue_dispatch() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.email_queue_wake() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;

-- has_role and is_super_admin are used by RLS policies; RLS runs as caller so caller needs EXECUTE
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, service_role;

-- Client-callable invite RPCs
REVOKE ALL ON FUNCTION public.get_invite_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invite_by_token(text) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.accept_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_invite(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.consume_invites_for_current_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_invites_for_current_user() TO authenticated, service_role;

-- service_role can always run everything (for triggers/cron/webhooks)
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.touch_updated_at() TO service_role;
GRANT EXECUTE ON FUNCTION public.protect_super_admin_role() TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_protected_super_admin(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_unique_shop_slug(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_queue_dispatch() TO service_role;
GRANT EXECUTE ON FUNCTION public.email_queue_wake() TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;

-- 3. profiles: restrict broad read to self + admins
DROP POLICY IF EXISTS "Profiles are readable by signed-in users" ON public.profiles;
CREATE POLICY "Users read their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);
CREATE POLICY "Admins read all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_super_admin() OR public.has_role(auth.uid(), 'admin'::app_role));

-- 4. platform_settings: restrict SELECT to authenticated
DROP POLICY IF EXISTS "Anyone may read settings" ON public.platform_settings;
CREATE POLICY "Authenticated users read settings"
  ON public.platform_settings FOR SELECT
  TO authenticated
  USING (true);

-- 5. shops: mask sensitive contact fields for anonymous visitors
-- Column-level revoke of sensitive fields from anon
REVOKE SELECT (phone, email, whatsapp, lat, lng) ON public.shops FROM anon;

-- Public view that respects display flags (SECURITY INVOKER via security_invoker=on)
DROP VIEW IF EXISTS public.shops_public;
CREATE VIEW public.shops_public
WITH (security_invoker = on) AS
SELECT
  id, manager_id, slug, name_en, name_ar, description_en, description_ar,
  cover_url, logo_url, address, city, district, country, full_address,
  google_maps_url, website, instagram, snapchat, tiktok,
  status, featured, published, paused_bookings, archived_at,
  rating_avg, rating_count, booking_enabled, walkin_enabled, accept_reviews,
  max_booking_window_days, booking_interval_minutes,
  display_phone, display_whatsapp, display_address,
  display_gallery, display_team, display_services,
  CASE WHEN display_phone THEN phone ELSE NULL END AS phone,
  CASE WHEN display_whatsapp THEN whatsapp ELSE NULL END AS whatsapp,
  email,
  CASE WHEN display_address THEN lat ELSE NULL END AS lat,
  CASE WHEN display_address THEN lng ELSE NULL END AS lng,
  created_at, updated_at
FROM public.shops;

GRANT SELECT ON public.shops_public TO anon, authenticated;
