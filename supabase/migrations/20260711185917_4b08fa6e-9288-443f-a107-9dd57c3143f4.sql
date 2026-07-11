
ALTER FUNCTION public.is_super_admin() SECURITY DEFINER;

-- Replace the user_roles policy that calls is_super_admin() with an inline check
-- so no RLS policy depends on the function (letting us revoke public EXECUTE).
DROP POLICY IF EXISTS "Super admins read all roles" ON public.user_roles;
CREATE POLICY "Super admins read all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
  ));

-- Same for other tables referencing is_super_admin() in policies
DROP POLICY IF EXISTS "Super admin updates settings" ON public.platform_settings;
CREATE POLICY "Super admin updates settings"
  ON public.platform_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Admins read all settings columns" ON public.platform_settings;
CREATE POLICY "Admins read all settings columns"
  ON public.platform_settings FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Admins delete shops" ON public.shops;
CREATE POLICY "Admins delete shops"
  ON public.shops FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Managers update their shop" ON public.shops;
CREATE POLICY "Managers update their shop"
  ON public.shops FOR UPDATE
  TO authenticated
  USING ((manager_id = auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Managers and admins read managed shops" ON public.shops;
CREATE POLICY "Managers and admins read managed shops"
  ON public.shops FOR SELECT
  TO authenticated
  USING ((manager_id = auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Super admins read all shops" ON public.shops;
CREATE POLICY "Super admins read all shops"
  ON public.shops FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM anon, authenticated, PUBLIC;
