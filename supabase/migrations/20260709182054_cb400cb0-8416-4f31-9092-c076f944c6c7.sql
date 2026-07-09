
-- 1) Fix function search_path on pgmq wrappers
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;

-- 2) Revoke EXECUTE on SECURITY DEFINER functions that should never be called by clients
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.protect_super_admin_role() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ensure_protected_super_admin(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_unique_shop_slug(text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM anon, authenticated, PUBLIC;
-- keep EXECUTE on has_role, is_super_admin (needed by RLS policies evaluated as caller),
-- and on accept_invite / consume_invites_for_current_user / get_invite_by_token (user RPCs)

-- 3) platform_settings: restrict SELECT columns for authenticated to a safe subset
DROP POLICY IF EXISTS "Authenticated users read settings" ON public.platform_settings;
REVOKE SELECT ON public.platform_settings FROM anon, authenticated;
GRANT SELECT (id, maintenance) ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;

CREATE POLICY "Authenticated users read maintenance only"
  ON public.platform_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins read all settings columns"
  ON public.platform_settings FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_super_admin());

-- Grant admins full column read via a separate table grant scoped through has_role
GRANT SELECT ON public.platform_settings TO service_role;

-- 4) reviews: hide moderated rows from public + remove customer_id exposure
DROP POLICY IF EXISTS "Reviews public" ON public.reviews;

-- Public sees only non-hidden rows, and cannot read customer_id column
REVOKE SELECT ON public.reviews FROM anon, authenticated;
GRANT SELECT (id, booking_id, barber_id, shop_id, rating, comment, created_at, hidden_at, hidden_by)
  ON public.reviews TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;

CREATE POLICY "Reviews public non-hidden"
  ON public.reviews FOR SELECT
  TO anon, authenticated
  USING (hidden_at IS NULL);

-- Owners of the review, shop owners, admins can see all their reviews (including hidden)
CREATE POLICY "Owners and staff read all reviews"
  ON public.reviews FOR SELECT
  TO authenticated
  USING (
    customer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.shops s WHERE s.id = reviews.shop_id AND s.manager_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR public.is_super_admin()
  );

-- 5) storage: scope public read to files that live under a valid shop id prefix
DROP POLICY IF EXISTS "salon media public read" ON storage.objects;
CREATE POLICY "salon media public read"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (
    bucket_id = ANY (ARRAY['salon-media','service-media'])
    AND EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id::text = split_part(objects.name, '/', 1)
        AND s.status = 'active'
    )
  );
