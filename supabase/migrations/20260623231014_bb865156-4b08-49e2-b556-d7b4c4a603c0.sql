
-- 1. Fix function search_path
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;

-- 2. Restrict invites SELECT to admins only; keep write access for shop managers
DROP POLICY IF EXISTS "Admin/manager manages invites" ON public.invites;

CREATE POLICY "Admins read invites"
  ON public.invites
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admin/manager insert invites"
  ON public.invites
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (shop_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = invites.shop_id AND s.manager_id = auth.uid()
    ))
  );

CREATE POLICY "Admin/manager update invites"
  ON public.invites
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (shop_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = invites.shop_id AND s.manager_id = auth.uid()
    ))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (shop_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = invites.shop_id AND s.manager_id = auth.uid()
    ))
  );

CREATE POLICY "Admin/manager delete invites"
  ON public.invites
  FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (shop_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = invites.shop_id AND s.manager_id = auth.uid()
    ))
  );

-- 3. Revoke phone column SELECT from anon on shops
REVOKE SELECT (phone) ON public.shops FROM anon;
