
-- Owners can manage invites that belong to a shop they manage
CREATE POLICY "Owners read shop invites" ON public.invites
  FOR SELECT TO authenticated
  USING (
    shop_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = invites.shop_id AND s.manager_id = auth.uid()
    )
  );

CREATE POLICY "Owners insert shop invites" ON public.invites
  FOR INSERT TO authenticated
  WITH CHECK (
    shop_id IS NOT NULL
    AND role IN ('barber'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = invites.shop_id AND s.manager_id = auth.uid()
    )
  );

CREATE POLICY "Owners update shop invites" ON public.invites
  FOR UPDATE TO authenticated
  USING (
    shop_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = invites.shop_id AND s.manager_id = auth.uid()
    )
  )
  WITH CHECK (
    shop_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = invites.shop_id AND s.manager_id = auth.uid()
    )
  );
