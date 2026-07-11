-- Allow shop owners to manage barber invitation codes for their own shop
CREATE POLICY "owners_insert_barber_invitation_codes"
  ON public.invitation_codes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    role = 'barber'
    AND shop_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.shops s WHERE s.id = invitation_codes.shop_id AND s.manager_id = auth.uid())
  );

CREATE POLICY "owners_select_barber_invitation_codes"
  ON public.invitation_codes
  FOR SELECT
  TO authenticated
  USING (
    role = 'barber'
    AND shop_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.shops s WHERE s.id = invitation_codes.shop_id AND s.manager_id = auth.uid())
  );

CREATE POLICY "owners_update_barber_invitation_codes"
  ON public.invitation_codes
  FOR UPDATE
  TO authenticated
  USING (
    role = 'barber'
    AND shop_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.shops s WHERE s.id = invitation_codes.shop_id AND s.manager_id = auth.uid())
  )
  WITH CHECK (
    role = 'barber'
    AND shop_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.shops s WHERE s.id = invitation_codes.shop_id AND s.manager_id = auth.uid())
  );