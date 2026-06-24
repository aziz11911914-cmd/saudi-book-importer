
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('customer', 'barber', 'manager', 'admin');
CREATE TYPE public.booking_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled', 'no_show');
CREATE TYPE public.entity_status AS ENUM ('active', 'inactive', 'pending');
CREATE TYPE public.favorite_target AS ENUM ('barber', 'shop');

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  locale TEXT NOT NULL DEFAULT 'ar',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are readable by signed-in users" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users manage their own profile" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- =========================================================
-- USER ROLES (separate table for security)
-- =========================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read their own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Admins can manage all roles
CREATE POLICY "Admins manage all roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- AUTO-CREATE PROFILE + DEFAULT ROLE ON SIGNUP
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'full_name'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'customer')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- updated_at helper
-- =========================================================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- OTP CHALLENGES
-- =========================================================
CREATE TABLE public.auth_otp_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  user_id UUID,
  code_hash TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  verification_type TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX auth_otp_challenges_email_idx ON public.auth_otp_challenges(email);
CREATE INDEX auth_otp_challenges_code_idx ON public.auth_otp_challenges(email, code_hash);
GRANT ALL ON public.auth_otp_challenges TO service_role;
ALTER TABLE public.auth_otp_challenges ENABLE ROW LEVEL SECURITY;
-- No policies = only service_role (used by server functions) can access.

-- =========================================================
-- INVITES
-- =========================================================
CREATE TABLE public.invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role public.app_role NOT NULL,
  shop_id UUID,
  token TEXT NOT NULL UNIQUE,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX invites_email_idx ON public.invites(email);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invites TO authenticated;
GRANT ALL ON public.invites TO service_role;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage invites" ON public.invites FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- SPECIALTIES
-- =========================================================
CREATE TABLE public.specialties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  label_en TEXT NOT NULL,
  label_ar TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.specialties TO anon, authenticated;
GRANT ALL ON public.specialties TO service_role;
ALTER TABLE public.specialties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Specialties are public" ON public.specialties FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage specialties" ON public.specialties FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.specialties (slug, label_en, label_ar, sort_order) VALUES
  ('fade','Fade','تدرج',1),
  ('skin-fade','Skin Fade','تدرج جلدي',2),
  ('taper-fade','Taper Fade','تدرج خفيف',3),
  ('french-crop','French Crop','فرنش كروب',4),
  ('buzz-cut','Buzz Cut','قصة بوز',5),
  ('beard-styling','Beard Styling','تنسيق اللحية',6);

-- =========================================================
-- SHOPS
-- =========================================================
CREATE TABLE public.shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  slug TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  description_en TEXT,
  description_ar TEXT,
  cover_url TEXT,
  lat NUMERIC,
  lng NUMERIC,
  address TEXT,
  city TEXT,
  district TEXT,
  phone TEXT,
  status public.entity_status NOT NULL DEFAULT 'pending',
  featured BOOLEAN NOT NULL DEFAULT false,
  rating_avg NUMERIC NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.shops TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.shops TO authenticated;
GRANT ALL ON public.shops TO service_role;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active shops are public" ON public.shops FOR SELECT TO anon, authenticated USING (status = 'active' OR manager_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Managers update their shop" ON public.shops FOR UPDATE TO authenticated USING (manager_id = auth.uid() OR public.has_role(auth.uid(), 'admin')) WITH CHECK (manager_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert shops" ON public.shops FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete shops" ON public.shops FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER shops_touch BEFORE UPDATE ON public.shops FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- SHOP PHOTOS & HOURS
-- =========================================================
CREATE TABLE public.shop_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.shop_photos TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.shop_photos TO authenticated;
GRANT ALL ON public.shop_photos TO service_role;
ALTER TABLE public.shop_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shop photos are public" ON public.shop_photos FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Managers manage shop photos" ON public.shop_photos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND (s.manager_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND (s.manager_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

CREATE TABLE public.shop_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  opens_at TIME NOT NULL,
  closes_at TIME NOT NULL
);
GRANT SELECT ON public.shop_hours TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.shop_hours TO authenticated;
GRANT ALL ON public.shop_hours TO service_role;
ALTER TABLE public.shop_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shop hours are public" ON public.shop_hours FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Managers manage shop hours" ON public.shop_hours FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND (s.manager_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND (s.manager_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

-- =========================================================
-- BARBERS
-- =========================================================
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
  years_experience INTEGER NOT NULL DEFAULT 0,
  status public.entity_status NOT NULL DEFAULT 'pending',
  featured BOOLEAN NOT NULL DEFAULT false,
  rating_avg NUMERIC NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  appointments_completed INTEGER NOT NULL DEFAULT 0,
  clients_served INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX barbers_shop_idx ON public.barbers(shop_id);
GRANT SELECT ON public.barbers TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.barbers TO authenticated;
GRANT ALL ON public.barbers TO service_role;
ALTER TABLE public.barbers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active barbers are public" ON public.barbers FOR SELECT TO anon, authenticated USING (status = 'active' OR profile_id = auth.uid() OR EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.manager_id = auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Barber manages self; manager manages team" ON public.barbers FOR ALL TO authenticated
  USING (profile_id = auth.uid() OR EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.manager_id = auth.uid()) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (profile_id = auth.uid() OR EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.manager_id = auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER barbers_touch BEFORE UPDATE ON public.barbers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- BARBER SPECIALTIES
-- =========================================================
CREATE TABLE public.barber_specialties (
  barber_id UUID NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  specialty_id UUID NOT NULL REFERENCES public.specialties(id) ON DELETE CASCADE,
  PRIMARY KEY (barber_id, specialty_id)
);
GRANT SELECT ON public.barber_specialties TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.barber_specialties TO authenticated;
GRANT ALL ON public.barber_specialties TO service_role;
ALTER TABLE public.barber_specialties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Barber specialties public" ON public.barber_specialties FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Barber/manager manages specialties" ON public.barber_specialties FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.barbers b LEFT JOIN public.shops s ON s.id = b.shop_id WHERE b.id = barber_id AND (b.profile_id = auth.uid() OR s.manager_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.barbers b LEFT JOIN public.shops s ON s.id = b.shop_id WHERE b.id = barber_id AND (b.profile_id = auth.uid() OR s.manager_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

-- =========================================================
-- PORTFOLIO PHOTOS & TAGS
-- =========================================================
CREATE TABLE public.portfolio_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id UUID NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  caption_en TEXT,
  caption_ar TEXT,
  sort INTEGER NOT NULL DEFAULT 0,
  starting_price_sar NUMERIC,
  service_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX portfolio_photos_barber_idx ON public.portfolio_photos(barber_id);
GRANT SELECT ON public.portfolio_photos TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.portfolio_photos TO authenticated;
GRANT ALL ON public.portfolio_photos TO service_role;
ALTER TABLE public.portfolio_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Portfolio public" ON public.portfolio_photos FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Barber/manager manages portfolio" ON public.portfolio_photos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.barbers b LEFT JOIN public.shops s ON s.id = b.shop_id WHERE b.id = barber_id AND (b.profile_id = auth.uid() OR s.manager_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.barbers b LEFT JOIN public.shops s ON s.id = b.shop_id WHERE b.id = barber_id AND (b.profile_id = auth.uid() OR s.manager_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

CREATE TABLE public.portfolio_photo_specialties (
  photo_id UUID NOT NULL REFERENCES public.portfolio_photos(id) ON DELETE CASCADE,
  specialty_id UUID NOT NULL REFERENCES public.specialties(id) ON DELETE CASCADE,
  PRIMARY KEY (photo_id, specialty_id)
);
GRANT SELECT ON public.portfolio_photo_specialties TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.portfolio_photo_specialties TO authenticated;
GRANT ALL ON public.portfolio_photo_specialties TO service_role;
ALTER TABLE public.portfolio_photo_specialties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Photo tags public" ON public.portfolio_photo_specialties FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Barber/manager manages photo tags" ON public.portfolio_photo_specialties FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.portfolio_photos p JOIN public.barbers b ON b.id = p.barber_id LEFT JOIN public.shops s ON s.id = b.shop_id WHERE p.id = photo_id AND (b.profile_id = auth.uid() OR s.manager_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.portfolio_photos p JOIN public.barbers b ON b.id = p.barber_id LEFT JOIN public.shops s ON s.id = b.shop_id WHERE p.id = photo_id AND (b.profile_id = auth.uid() OR s.manager_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

-- =========================================================
-- SERVICES & BARBER SERVICES
-- =========================================================
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  description_en TEXT,
  description_ar TEXT,
  price_sar NUMERIC NOT NULL DEFAULT 0,
  duration_min INTEGER NOT NULL DEFAULT 30,
  category TEXT NOT NULL DEFAULT 'haircut',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.services TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Services public" ON public.services FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Manager manages services" ON public.services FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND (s.manager_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND (s.manager_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

ALTER TABLE public.portfolio_photos ADD CONSTRAINT portfolio_photos_service_fk
  FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;

CREATE TABLE public.barber_services (
  barber_id UUID NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  PRIMARY KEY (barber_id, service_id)
);
GRANT SELECT ON public.barber_services TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.barber_services TO authenticated;
GRANT ALL ON public.barber_services TO service_role;
ALTER TABLE public.barber_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Barber services public" ON public.barber_services FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Barber/manager manages barber_services" ON public.barber_services FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.barbers b LEFT JOIN public.shops s ON s.id = b.shop_id WHERE b.id = barber_id AND (b.profile_id = auth.uid() OR s.manager_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.barbers b LEFT JOIN public.shops s ON s.id = b.shop_id WHERE b.id = barber_id AND (b.profile_id = auth.uid() OR s.manager_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

-- =========================================================
-- BARBER AVAILABILITY / TIME OFF
-- =========================================================
CREATE TABLE public.barber_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id UUID NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  starts_at TIME NOT NULL,
  ends_at TIME NOT NULL
);
GRANT SELECT ON public.barber_availability TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.barber_availability TO authenticated;
GRANT ALL ON public.barber_availability TO service_role;
ALTER TABLE public.barber_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Availability public" ON public.barber_availability FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Barber/manager manages availability" ON public.barber_availability FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.barbers b LEFT JOIN public.shops s ON s.id = b.shop_id WHERE b.id = barber_id AND (b.profile_id = auth.uid() OR s.manager_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.barbers b LEFT JOIN public.shops s ON s.id = b.shop_id WHERE b.id = barber_id AND (b.profile_id = auth.uid() OR s.manager_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

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
CREATE POLICY "Barber/manager reads time off" ON public.barber_time_off FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.barbers b LEFT JOIN public.shops s ON s.id = b.shop_id WHERE b.id = barber_id AND (b.profile_id = auth.uid() OR s.manager_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "Barber/manager manages time off" ON public.barber_time_off FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.barbers b LEFT JOIN public.shops s ON s.id = b.shop_id WHERE b.id = barber_id AND (b.profile_id = auth.uid() OR s.manager_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.barbers b LEFT JOIN public.shops s ON s.id = b.shop_id WHERE b.id = barber_id AND (b.profile_id = auth.uid() OR s.manager_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

-- =========================================================
-- BOOKINGS
-- =========================================================
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_ref TEXT NOT NULL UNIQUE DEFAULT upper(substring(md5(random()::text) for 8)),
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  barber_id UUID NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  price_sar NUMERIC NOT NULL,
  status public.booking_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX bookings_customer_idx ON public.bookings(customer_id);
CREATE INDEX bookings_barber_starts_idx ON public.bookings(barber_id, starts_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customer reads own bookings" ON public.bookings FOR SELECT TO authenticated
  USING (customer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.barbers b WHERE b.id = barber_id AND b.profile_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.manager_id = auth.uid())
    OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Customer creates own booking" ON public.bookings FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY "Booking parties update" ON public.bookings FOR UPDATE TO authenticated
  USING (customer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.barbers b WHERE b.id = barber_id AND b.profile_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.manager_id = auth.uid())
    OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER bookings_touch BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- REVIEWS
-- =========================================================
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
GRANT SELECT ON public.reviews TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reviews public" ON public.reviews FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Customer writes own review" ON public.reviews FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY "Customer edits own review" ON public.reviews FOR UPDATE TO authenticated USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
CREATE POLICY "Customer deletes own review" ON public.reviews FOR DELETE TO authenticated USING (customer_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- =========================================================
-- DEMO REVIEWS (placeholder content used by current UI)
-- =========================================================
CREATE TABLE public.demo_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  barber_id UUID REFERENCES public.barbers(id) ON DELETE CASCADE,
  reviewer_name TEXT NOT NULL,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.demo_reviews TO anon, authenticated;
GRANT ALL ON public.demo_reviews TO service_role;
ALTER TABLE public.demo_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Demo reviews public" ON public.demo_reviews FOR SELECT TO anon, authenticated USING (true);

-- =========================================================
-- FAVORITES
-- =========================================================
CREATE TABLE public.favorites (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type public.favorite_target NOT NULL,
  target_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, target_type, target_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.favorites TO authenticated;
GRANT ALL ON public.favorites TO service_role;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their favorites" ON public.favorites FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
