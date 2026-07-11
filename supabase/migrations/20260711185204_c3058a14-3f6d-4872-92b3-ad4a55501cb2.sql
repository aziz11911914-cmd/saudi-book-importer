
CREATE TABLE IF NOT EXISTS public.owner_customer_flags (
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  notes text,
  blocked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (shop_id, customer_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_customer_flags TO authenticated;
GRANT ALL ON public.owner_customer_flags TO service_role;

ALTER TABLE public.owner_customer_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their shop customer flags"
  ON public.owner_customer_flags
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = owner_customer_flags.shop_id AND s.manager_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = owner_customer_flags.shop_id AND s.manager_id = auth.uid()));

CREATE POLICY "Super admins manage all customer flags"
  ON public.owner_customer_flags
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER touch_owner_customer_flags
  BEFORE UPDATE ON public.owner_customer_flags
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
