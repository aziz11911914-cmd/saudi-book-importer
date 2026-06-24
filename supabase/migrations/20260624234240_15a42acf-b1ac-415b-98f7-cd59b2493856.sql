CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(_user_id = auth.uid(), false)
    AND EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND role = _role
    )
$$;

GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Active shops are public" ON public.shops;
CREATE POLICY "Active shops are public"
ON public.shops
FOR SELECT
TO anon, authenticated
USING (status = 'active'::public.entity_status);

CREATE POLICY "Managers and admins can read managed shops"
ON public.shops
FOR SELECT
TO authenticated
USING (manager_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Active barbers are public" ON public.barbers;
CREATE POLICY "Active barbers are public"
ON public.barbers
FOR SELECT
TO anon, authenticated
USING (status = 'active'::public.entity_status);

CREATE POLICY "Barbers managers and admins can read managed barbers"
ON public.barbers
FOR SELECT
TO authenticated
USING (
  profile_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.shops s
    WHERE s.id = barbers.shop_id
      AND s.manager_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);