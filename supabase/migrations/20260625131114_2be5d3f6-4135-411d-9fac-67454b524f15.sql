
-- 1) Fix shops RLS so super_admin can manage salons
DROP POLICY IF EXISTS "Admins insert shops" ON public.shops;
DROP POLICY IF EXISTS "Admins delete shops" ON public.shops;
DROP POLICY IF EXISTS "Managers update their shop" ON public.shops;
DROP POLICY IF EXISTS "Managers and admins can read managed shops" ON public.shops;

CREATE POLICY "Admins insert shops" ON public.shops
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete shops" ON public.shops
  FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers update their shop" ON public.shops
  FOR UPDATE TO authenticated
  USING (manager_id = auth.uid() OR public.is_super_admin() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (manager_id = auth.uid() OR public.is_super_admin() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers and admins read managed shops" ON public.shops
  FOR SELECT TO authenticated
  USING (manager_id = auth.uid() OR public.is_super_admin() OR public.has_role(auth.uid(), 'admin'));

-- 2) Extend invites table with status tracking
DO $$ BEGIN
  CREATE TYPE invite_status AS ENUM ('pending','accepted','revoked','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.invites
  ADD COLUMN IF NOT EXISTS status invite_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS notes text;

-- Backfill status from used_at/expires_at
UPDATE public.invites SET status = 'accepted' WHERE used_at IS NOT NULL AND status = 'pending';
UPDATE public.invites SET status = 'expired' WHERE used_at IS NULL AND expires_at < now() AND status = 'pending';

-- 3) Public RPC: fetch invite by token (for public /invite/$token page)
CREATE OR REPLACE FUNCTION public.get_invite_by_token(_token text)
RETURNS TABLE (
  id uuid, email text, role app_role, shop_id uuid,
  shop_name_en text, shop_name_ar text,
  expires_at timestamptz, status invite_status,
  invited_by_name text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.id, i.email, i.role, i.shop_id,
         s.name_en, s.name_ar,
         i.expires_at,
         CASE
           WHEN i.status = 'accepted' THEN 'accepted'::invite_status
           WHEN i.status = 'revoked' THEN 'revoked'::invite_status
           WHEN i.expires_at < now() THEN 'expired'::invite_status
           ELSE 'pending'::invite_status
         END,
         p.full_name
    FROM public.invites i
    LEFT JOIN public.shops s ON s.id = i.shop_id
    LEFT JOIN public.profiles p ON p.id = i.invited_by
   WHERE i.token = _token
   LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_invite_by_token(text) TO anon, authenticated;

-- 4) Accept invite RPC (consumes a specific token for the current user)
CREATE OR REPLACE FUNCTION public.accept_invite(_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  uemail text;
  inv record;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT lower(email) INTO uemail FROM auth.users WHERE id = uid;

  SELECT * INTO inv FROM public.invites WHERE token = _token;
  IF inv IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;
  IF inv.status = 'revoked' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'revoked');
  END IF;
  IF inv.status = 'accepted' OR inv.used_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_used');
  END IF;
  IF inv.expires_at < now() THEN
    UPDATE public.invites SET status = 'expired' WHERE id = inv.id;
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;
  IF lower(inv.email) <> uemail THEN
    RETURN jsonb_build_object('ok', false, 'error', 'wrong_email', 'expected', inv.email);
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (uid, inv.role)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF inv.role = 'owner' AND inv.shop_id IS NOT NULL THEN
    UPDATE public.shops SET manager_id = uid WHERE id = inv.shop_id;
  END IF;

  IF inv.role = 'barber' AND inv.shop_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.barbers WHERE user_id = uid AND shop_id = inv.shop_id) THEN
      INSERT INTO public.barbers (user_id, shop_id, display_name_en, display_name_ar, status)
      SELECT uid,
             inv.shop_id,
             COALESCE(inv.full_name, p.full_name, p.email),
             COALESCE(inv.full_name, p.full_name, p.email),
             'active'
        FROM public.profiles p WHERE p.id = uid;
    END IF;
  END IF;

  IF inv.full_name IS NOT NULL OR inv.phone IS NOT NULL THEN
    UPDATE public.profiles SET
      full_name = COALESCE(full_name, inv.full_name),
      phone = COALESCE(phone, inv.phone)
     WHERE id = uid;
  END IF;

  UPDATE public.invites SET
    used_at = now(),
    status = 'accepted',
    accepted_at = now(),
    accepted_by = uid
   WHERE id = inv.id;

  INSERT INTO public.audit_logs (actor_id, actor_email, action, target_type, target_id, details)
  VALUES (uid, uemail, 'invite.accepted', 'invite', inv.id::text,
          jsonb_build_object('role', inv.role, 'shop_id', inv.shop_id));

  RETURN jsonb_build_object('ok', true, 'role', inv.role, 'shop_id', inv.shop_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_invite(text) TO authenticated;

-- 5) Auto-slug helper
CREATE OR REPLACE FUNCTION public.generate_unique_shop_slug(_base text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  base text;
  candidate text;
  i int := 0;
BEGIN
  base := lower(regexp_replace(coalesce(_base,''), '[^a-z0-9]+', '-', 'gi'));
  base := regexp_replace(base, '(^-+|-+$)', '', 'g');
  IF length(base) = 0 THEN base := 'salon'; END IF;
  candidate := base;
  WHILE EXISTS (SELECT 1 FROM public.shops WHERE slug = candidate) LOOP
    i := i + 1;
    candidate := base || '-' || i::text;
  END LOOP;
  RETURN candidate;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_unique_shop_slug(text) TO authenticated;

-- 6) Audit customer registration via handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

  INSERT INTO public.audit_logs (actor_id, actor_email, action, target_type, target_id, details)
  VALUES (NEW.id, NEW.email, 'customer.registered', 'profile', NEW.id::text, '{}'::jsonb);

  RETURN NEW;
END;
$$;
