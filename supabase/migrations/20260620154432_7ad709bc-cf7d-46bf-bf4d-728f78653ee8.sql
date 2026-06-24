
-- ============== ENUMS ==============
CREATE TYPE public.app_role AS ENUM ('customer', 'barber', 'manager', 'admin');
CREATE TYPE public.shop_status AS ENUM ('pending', 'active', 'suspended');
CREATE TYPE public.barber_status AS ENUM ('pending', 'active', 'inactive');
CREATE TYPE public.booking_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled', 'no_show');
CREATE TYPE public.service_category AS ENUM ('hair', 'beard', 'package', 'membership');
CREATE TYPE public.favorite_target AS ENUM ('barber', 'shop');

-- ============== PROFILES ==============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  locale TEXT NOT NULL DEFAULT 'ar',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by owner" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Profiles updatable by owner" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Profiles insertable by owner" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- ============== USER ROLES ==============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- ============== AUTO PROFILE + ROLE ON SIGNUP ==============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, locale)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), 'ar');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============== SPECIALTIES ==============
CREATE TABLE public.specialties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  label_en TEXT NOT NULL,
  label_ar TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);
GRANT SELECT ON public.specialties TO anon, authenticated;
GRANT ALL ON public.specialties TO service_role;
ALTER TABLE public.specialties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Specialties are public" ON public.specialties
  FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.specialties (slug, label_en, label_ar, sort_order) VALUES
  ('fade', 'Fade', 'تدرج', 1),
  ('skin-fade', 'Skin Fade', 'تدرج جلدي', 2),
  ('taper-fade', 'Taper Fade', 'تدرج خفيف', 3),
  ('french-crop', 'French Crop', 'فرنش كروب', 4),
  ('buzz-cut', 'Buzz Cut', 'قصة بوز', 5),
  ('beard-styling', 'Beard Styling', 'تنسيق اللحية', 6);

-- ============== SHOPS ==============
CREATE TABLE public.shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  slug TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  description_en TEXT,
  description_ar TEXT,
  cover_url TEXT,
  lat NUMERIC(10,7),
  lng NUMERIC(10,7),
  address TEXT,
  city TEXT,
  district TEXT,
  phone TEXT,
  status shop_status NOT NULL DEFAULT 'pending',
  featured BOOLEAN NOT NULL DEFAULT false,
  rating_avg NUMERIC(3,2) NOT NULL DEFAULT 0,
  rating_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.shops TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shops TO authenticated;
GRANT ALL ON public.shops TO service_role;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active shops are public" ON public.shops
  FOR SELECT TO anon, authenticated USING (status = 'active' OR manager_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Manager can update own shop" ON public.shops
  FOR UPDATE TO authenticated USING (manager_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (manager_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can insert shop" ON public.shops
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can delete shop" ON public.shops
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============== SHOP PHOTOS ==============
CREATE TABLE public.shop_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  sort INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.shop_photos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_photos TO authenticated;
GRANT ALL ON public.shop_photos TO service_role;
ALTER TABLE public.shop_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shop photos are public" ON public.shop_photos
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Manager manages shop photos" ON public.shop_photos
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND (s.manager_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND (s.manager_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

-- ============== SHOP HOURS ==============
CREATE TABLE public.shop_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  opens_at TIME NOT NULL,
  closes_at TIME NOT NULL
);
GRANT SELECT ON public.shop_hours TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_hours TO authenticated;
GRANT ALL ON public.shop_hours TO service_role;
ALTER TABLE public.shop_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shop hours are public" ON public.shop_hours
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Manager manages shop hours" ON public.shop_hours
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND (s.manager_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND (s.manager_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

-- ============== BARBERS ==============
CREATE TABLE public.barbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  display_name_en TEXT NOT NULL,
  display_name_ar TEXT NOT NULL,
  title_en TEXT NOT NULL DEFAULT 'Barber',
  title_ar TEXT NOT NULL DEFAULT 'حلاق',
  bio_en TEXT,
  bio_ar TEXT,
  photo_url TEXT,
  years_experience INT NOT NULL DEFAULT 0,
  status barber_status NOT NULL DEFAULT 'pending',
  rating_avg NUMERIC(3,2) NOT NULL DEFAULT 0,
  rating_count INT NOT NULL DEFAULT 0,
  appointments_completed INT NOT NULL DEFAULT 0,
  clients_served INT NOT NULL DEFAULT 0,
  featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_barbers_shop ON public.barbers(shop_id);
GRANT SELECT ON public.barbers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.barbers TO authenticated;
GRANT ALL ON public.barbers TO service_role;
ALTER TABLE public.barbers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active barbers are public" ON public.barbers
  FOR SELECT TO anon, authenticated USING (status = 'active' OR profile_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.manager_id = auth.uid()));
CREATE POLICY "Barber or manager can update" ON public.barbers
  FOR UPDATE TO authenticated
  USING (profile_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.manager_id = auth.uid()))
  WITH CHECK (profile_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.manager_id = auth.uid()));
CREATE POLICY "Manager can insert barber" ON public.barbers
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.manager_id = auth.uid()));
CREATE POLICY "Manager can delete barber" ON public.barbers
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.manager_id = auth.uid()));

-- ============== BARBER SPECIALTIES ==============
CREATE TABLE public.barber_specialties (
  barber_id UUID NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  specialty_id UUID NOT NULL REFERENCES public.specialties(id) ON DELETE CASCADE,
  PRIMARY KEY (barber_id, specialty_id)
);
GRANT SELECT ON public.barber_specialties TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.barber_specialties TO authenticated;
GRANT ALL ON public.barber_specialties TO service_role;
ALTER TABLE public.barber_specialties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Barber specialties public" ON public.barber_specialties
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Barber/manager manages specialties" ON public.barber_specialties
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.barbers b LEFT JOIN public.shops s ON s.id = b.shop_id
    WHERE b.id = barber_id AND (b.profile_id = auth.uid() OR s.manager_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.barbers b LEFT JOIN public.shops s ON s.id = b.shop_id
    WHERE b.id = barber_id AND (b.profile_id = auth.uid() OR s.manager_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

-- ============== PORTFOLIO PHOTOS ==============
CREATE TABLE public.portfolio_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id UUID NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  caption_en TEXT,
  caption_ar TEXT,
  sort INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_portfolio_barber ON public.portfolio_photos(barber_id);
GRANT SELECT ON public.portfolio_photos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_photos TO authenticated;
GRANT ALL ON public.portfolio_photos TO service_role;
ALTER TABLE public.portfolio_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Portfolio photos public" ON public.portfolio_photos
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Barber/manager manages portfolio" ON public.portfolio_photos
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.barbers b LEFT JOIN public.shops s ON s.id = b.shop_id
    WHERE b.id = barber_id AND (b.profile_id = auth.uid() OR s.manager_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.barbers b LEFT JOIN public.shops s ON s.id = b.shop_id
    WHERE b.id = barber_id AND (b.profile_id = auth.uid() OR s.manager_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

CREATE TABLE public.portfolio_photo_specialties (
  photo_id UUID NOT NULL REFERENCES public.portfolio_photos(id) ON DELETE CASCADE,
  specialty_id UUID NOT NULL REFERENCES public.specialties(id) ON DELETE CASCADE,
  PRIMARY KEY (photo_id, specialty_id)
);
GRANT SELECT ON public.portfolio_photo_specialties TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_photo_specialties TO authenticated;
GRANT ALL ON public.portfolio_photo_specialties TO service_role;
ALTER TABLE public.portfolio_photo_specialties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Portfolio tags public" ON public.portfolio_photo_specialties
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Barber/manager manages portfolio tags" ON public.portfolio_photo_specialties
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.portfolio_photos p JOIN public.barbers b ON b.id = p.barber_id
    LEFT JOIN public.shops s ON s.id = b.shop_id
    WHERE p.id = photo_id AND (b.profile_id = auth.uid() OR s.manager_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.portfolio_photos p JOIN public.barbers b ON b.id = p.barber_id
    LEFT JOIN public.shops s ON s.id = b.shop_id
    WHERE p.id = photo_id AND (b.profile_id = auth.uid() OR s.manager_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

-- ============== SERVICES ==============
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  description_en TEXT,
  description_ar TEXT,
  price_sar NUMERIC(10,2) NOT NULL,
  duration_min INT NOT NULL,
  category service_category NOT NULL DEFAULT 'hair',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_services_shop ON public.services(shop_id);
GRANT SELECT ON public.services TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active services public" ON public.services
  FOR SELECT TO anon, authenticated USING (active = true
    OR EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.manager_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Manager manages services" ON public.services
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND (s.manager_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND (s.manager_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

CREATE TABLE public.barber_services (
  barber_id UUID NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  PRIMARY KEY (barber_id, service_id)
);
GRANT SELECT ON public.barber_services TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.barber_services TO authenticated;
GRANT ALL ON public.barber_services TO service_role;
ALTER TABLE public.barber_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Barber services public" ON public.barber_services
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Manager manages barber services" ON public.barber_services
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.barbers b LEFT JOIN public.shops s ON s.id = b.shop_id
    WHERE b.id = barber_id AND (b.profile_id = auth.uid() OR s.manager_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.barbers b LEFT JOIN public.shops s ON s.id = b.shop_id
    WHERE b.id = barber_id AND (b.profile_id = auth.uid() OR s.manager_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

-- ============== AVAILABILITY ==============
CREATE TABLE public.barber_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id UUID NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  starts_at TIME NOT NULL,
  ends_at TIME NOT NULL
);
GRANT SELECT ON public.barber_availability TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.barber_availability TO authenticated;
GRANT ALL ON public.barber_availability TO service_role;
ALTER TABLE public.barber_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Availability public" ON public.barber_availability
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Barber/manager manages availability" ON public.barber_availability
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.barbers b LEFT JOIN public.shops s ON s.id = b.shop_id
    WHERE b.id = barber_id AND (b.profile_id = auth.uid() OR s.manager_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.barbers b LEFT JOIN public.shops s ON s.id = b.shop_id
    WHERE b.id = barber_id AND (b.profile_id = auth.uid() OR s.manager_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

CREATE TABLE public.barber_time_off (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id UUID NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  reason TEXT
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.barber_time_off TO authenticated;
GRANT ALL ON public.barber_time_off TO service_role;
ALTER TABLE public.barber_time_off ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Time off visible to barber/manager" ON public.barber_time_off
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.barbers b LEFT JOIN public.shops s ON s.id = b.shop_id
    WHERE b.id = barber_id AND (b.profile_id = auth.uid() OR s.manager_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.barbers b LEFT JOIN public.shops s ON s.id = b.shop_id
    WHERE b.id = barber_id AND (b.profile_id = auth.uid() OR s.manager_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

-- ============== BOOKINGS ==============
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  barber_id UUID NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  price_sar NUMERIC(10,2) NOT NULL,
  status booking_status NOT NULL DEFAULT 'confirmed',
  booking_ref TEXT NOT NULL UNIQUE DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bookings_customer ON public.bookings(customer_id);
CREATE INDEX idx_bookings_barber_time ON public.bookings(barber_id, starts_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customer reads own bookings" ON public.bookings
  FOR SELECT TO authenticated USING (
    customer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.barbers b WHERE b.id = barber_id AND b.profile_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.manager_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Customer creates own booking" ON public.bookings
  FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY "Customer/barber/manager updates booking" ON public.bookings
  FOR UPDATE TO authenticated USING (
    customer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.barbers b WHERE b.id = barber_id AND b.profile_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.manager_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- Overlap prevention trigger
CREATE OR REPLACE FUNCTION public.prevent_booking_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('cancelled', 'no_show') THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.bookings
    WHERE barber_id = NEW.barber_id
      AND id <> NEW.id
      AND status NOT IN ('cancelled', 'no_show')
      AND tstzrange(starts_at, ends_at, '[)') && tstzrange(NEW.starts_at, NEW.ends_at, '[)')
  ) THEN
    RAISE EXCEPTION 'This time slot overlaps an existing booking for this barber';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_prevent_booking_overlap
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.prevent_booking_overlap();

-- ============== REVIEWS ==============
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  barber_id UUID NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reviews_barber ON public.reviews(barber_id);
GRANT SELECT ON public.reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reviews public" ON public.reviews
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Customer creates review for own completed booking" ON public.reviews
  FOR INSERT TO authenticated WITH CHECK (
    customer_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id AND b.customer_id = auth.uid()
      AND b.barber_id = reviews.barber_id AND b.status = 'completed')
  );
CREATE POLICY "Customer updates own review" ON public.reviews
  FOR UPDATE TO authenticated USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
CREATE POLICY "Customer deletes own review" ON public.reviews
  FOR DELETE TO authenticated USING (customer_id = auth.uid());

-- Recompute aggregate ratings on review change
CREATE OR REPLACE FUNCTION public.recompute_barber_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_barber UUID;
  v_shop UUID;
BEGIN
  v_barber := COALESCE(NEW.barber_id, OLD.barber_id);
  v_shop := COALESCE(NEW.shop_id, OLD.shop_id);

  UPDATE public.barbers SET
    rating_avg = COALESCE((SELECT AVG(rating)::NUMERIC(3,2) FROM public.reviews WHERE barber_id = v_barber), 0),
    rating_count = COALESCE((SELECT COUNT(*) FROM public.reviews WHERE barber_id = v_barber), 0)
  WHERE id = v_barber;

  UPDATE public.shops SET
    rating_avg = COALESCE((SELECT AVG(rating)::NUMERIC(3,2) FROM public.reviews WHERE shop_id = v_shop), 0),
    rating_count = COALESCE((SELECT COUNT(*) FROM public.reviews WHERE shop_id = v_shop), 0)
  WHERE id = v_shop;

  RETURN COALESCE(NEW, OLD);
END;
$$;
CREATE TRIGGER trg_recompute_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.recompute_barber_rating();

-- ============== FAVORITES ==============
CREATE TABLE public.favorites (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type favorite_target NOT NULL,
  target_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, target_type, target_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.favorites TO authenticated;
GRANT ALL ON public.favorites TO service_role;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages favorites" ON public.favorites
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============== INVITES ==============
CREATE TABLE public.invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role app_role NOT NULL,
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invites TO authenticated;
GRANT ALL ON public.invites TO service_role;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin/manager manages invites" ON public.invites
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')
    OR (shop_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.manager_id = auth.uid())))
  WITH CHECK (public.has_role(auth.uid(), 'admin')
    OR (shop_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.manager_id = auth.uid())));
