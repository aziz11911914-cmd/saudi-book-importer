
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS instagram text,
  ADD COLUMN IF NOT EXISTS snapchat text,
  ADD COLUMN IF NOT EXISTS tiktok text,
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'SA',
  ADD COLUMN IF NOT EXISTS full_address text,
  ADD COLUMN IF NOT EXISTS google_maps_url text,
  ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS paused_bookings boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS display_phone boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS display_whatsapp boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS display_address boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS display_gallery boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS display_team boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS display_services boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS deletion_requested_by uuid;

DO $$ BEGIN
  CREATE TYPE public.holiday_kind AS ENUM ('vacation','holiday','temporary','emergency');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.shop_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  kind public.holiday_kind NOT NULL DEFAULT 'holiday',
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_holidays TO authenticated;
GRANT SELECT ON public.shop_holidays TO anon;
GRANT ALL ON public.shop_holidays TO service_role;
ALTER TABLE public.shop_holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads shop holidays" ON public.shop_holidays FOR SELECT USING (true);
CREATE POLICY "owner manages own shop holidays" ON public.shop_holidays FOR ALL
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.manager_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.manager_id = auth.uid()));
CREATE POLICY "super admin manages all holidays" ON public.shop_holidays FOR ALL
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER trg_shop_holidays_updated_at BEFORE UPDATE ON public.shop_holidays
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.service_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name_en text NOT NULL,
  name_ar text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, name_en)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_categories TO authenticated;
GRANT SELECT ON public.service_categories TO anon;
GRANT ALL ON public.service_categories TO service_role;
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads service categories" ON public.service_categories FOR SELECT USING (true);
CREATE POLICY "owner manages own service categories" ON public.service_categories FOR ALL
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.manager_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.manager_id = auth.uid()));
CREATE POLICY "super admin manages all categories" ON public.service_categories FOR ALL
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER trg_service_categories_updated_at BEFORE UPDATE ON public.service_categories
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DO $$ BEGIN
  CREATE TYPE public.service_status AS ENUM ('active','hidden','unavailable','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.service_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status public.service_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS prep_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cleanup_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS buffer_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS popular boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recommended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.services SET status = CASE WHEN active THEN 'active'::service_status ELSE 'hidden'::service_status END;

ALTER TABLE public.services DROP CONSTRAINT IF EXISTS services_price_nonneg;
ALTER TABLE public.services ADD CONSTRAINT services_price_nonneg CHECK (price_sar >= 0);
ALTER TABLE public.services DROP CONSTRAINT IF EXISTS services_duration_positive;
ALTER TABLE public.services ADD CONSTRAINT services_duration_positive CHECK (duration_min > 0);

CREATE UNIQUE INDEX IF NOT EXISTS services_shop_name_en_uniq ON public.services (shop_id, lower(name_en));
CREATE UNIQUE INDEX IF NOT EXISTS services_shop_name_ar_uniq ON public.services (shop_id, lower(name_ar));

DROP TRIGGER IF EXISTS trg_services_updated_at ON public.services;
CREATE TRIGGER trg_services_updated_at BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP POLICY IF EXISTS "owner manages own services" ON public.services;
CREATE POLICY "owner manages own services" ON public.services FOR ALL
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.manager_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.manager_id = auth.uid()));

DROP POLICY IF EXISTS "owner manages own shop hours" ON public.shop_hours;
CREATE POLICY "owner manages own shop hours" ON public.shop_hours FOR ALL
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.manager_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.manager_id = auth.uid()));

DROP POLICY IF EXISTS "owner manages own shop photos" ON public.shop_photos;
CREATE POLICY "owner manages own shop photos" ON public.shop_photos FOR ALL
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.manager_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.manager_id = auth.uid()));

DROP POLICY IF EXISTS "owner updates own shop" ON public.shops;
CREATE POLICY "owner updates own shop" ON public.shops FOR UPDATE
  USING (manager_id = auth.uid())
  WITH CHECK (manager_id = auth.uid());

DROP POLICY IF EXISTS "owner manages own barber services" ON public.barber_services;
CREATE POLICY "owner manages own barber services" ON public.barber_services FOR ALL
  USING (EXISTS (SELECT 1 FROM public.barbers b JOIN public.shops s ON s.id = b.shop_id WHERE b.id = barber_id AND s.manager_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.barbers b JOIN public.shops s ON s.id = b.shop_id WHERE b.id = barber_id AND s.manager_id = auth.uid()));
