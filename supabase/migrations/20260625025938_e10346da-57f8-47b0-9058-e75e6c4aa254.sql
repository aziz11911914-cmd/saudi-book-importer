
-- =====================================================
-- Migrate existing role rows to new naming
-- =====================================================
UPDATE public.user_roles SET role = 'super_admin' WHERE role = 'admin';
UPDATE public.user_roles SET role = 'owner' WHERE role = 'manager';

-- =====================================================
-- Profile additions
-- =====================================================
DO $$ BEGIN
  CREATE TYPE public.profile_status AS ENUM ('active','suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status public.profile_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS nationality text,
  ADD COLUMN IF NOT EXISTS language text DEFAULT 'ar',
  ADD COLUMN IF NOT EXISTS notes text;

-- =====================================================
-- Shop additions
-- =====================================================
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS booking_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS walkin_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accept_reviews boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS max_booking_window_days integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS booking_interval_minutes integer NOT NULL DEFAULT 30;

-- =====================================================
-- is_super_admin helper (keeps RLS policies short & uniform)
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, service_role;

-- =====================================================
-- audit_logs
-- =====================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  target_type text,
  target_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin reads all audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "Authenticated users can insert their own audit rows"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON public.audit_logs (actor_id);

-- =====================================================
-- notifications (in-app)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin());

CREATE POLICY "Users update their own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Super admin inserts notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR user_id = auth.uid());

CREATE POLICY "Users delete their own notifications"
  ON public.notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin());

CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications (user_id, created_at DESC);

-- =====================================================
-- platform_settings (singleton)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  general jsonb NOT NULL DEFAULT '{
    "platform_name": "Qassah",
    "logo_url": null,
    "contact_email": null,
    "contact_phone": null,
    "default_language": "ar",
    "timezone": "Asia/Riyadh"
  }'::jsonb,
  booking jsonb NOT NULL DEFAULT '{
    "booking_interval_minutes": 30,
    "max_booking_window_days": 30,
    "grace_period_minutes": 5,
    "cancellation_window_minutes": 60,
    "walkins_enabled": false,
    "reviews_enabled": true
  }'::jsonb,
  authentication jsonb NOT NULL DEFAULT '{
    "otp_enabled": true,
    "otp_expiration_seconds": 600,
    "session_timeout_hours": 168
  }'::jsonb,
  notifications jsonb NOT NULL DEFAULT '{
    "email_enabled": true,
    "announcements_enabled": true
  }'::jsonb,
  maintenance jsonb NOT NULL DEFAULT '{
    "enabled": false,
    "message": null
  }'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

INSERT INTO public.platform_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

GRANT SELECT ON public.platform_settings TO authenticated, anon;
GRANT UPDATE ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone may read settings"
  ON public.platform_settings FOR SELECT
  USING (true);

CREATE POLICY "Super admin updates settings"
  ON public.platform_settings FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE TRIGGER platform_settings_touch
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =====================================================
-- Seed initial super admin
-- =====================================================
DO $$
DECLARE seed_user uuid;
BEGIN
  SELECT id INTO seed_user FROM auth.users
  WHERE lower(email) = 'abdulazizalodan1@gmail.com'
  LIMIT 1;
  IF seed_user IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (seed_user, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;

-- Update handle_new_user to auto-grant super_admin to the seed email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, full_name)
  VALUES (
    NEW.id, NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'full_name'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'customer')
  ON CONFLICT (user_id, role) DO NOTHING;

  IF lower(NEW.email) = 'abdulazizalodan1@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure trigger exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;
