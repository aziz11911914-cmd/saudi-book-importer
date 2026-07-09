
-- Enum for status
DO $$ BEGIN
  CREATE TYPE public.invitation_code_status AS ENUM ('pending','activated','revoked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table
CREATE TABLE IF NOT EXISTS public.invitation_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  role app_role NOT NULL CHECK (role IN ('owner','barber')),
  shop_id uuid REFERENCES public.shops(id) ON DELETE SET NULL,
  status public.invitation_code_status NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  used_at timestamptz,
  activated_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invitation_codes_role_status_idx ON public.invitation_codes(role, status);
CREATE INDEX IF NOT EXISTS invitation_codes_shop_idx ON public.invitation_codes(shop_id);

-- Grants (admins read/write via authenticated + has_role check in policies)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitation_codes TO authenticated;
GRANT ALL ON public.invitation_codes TO service_role;

ALTER TABLE public.invitation_codes ENABLE ROW LEVEL SECURITY;

-- Only admins/super_admins can view invitation codes
CREATE POLICY "admins_select_invitation_codes"
  ON public.invitation_codes FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "admins_insert_invitation_codes"
  ON public.invitation_codes FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "admins_update_invitation_codes"
  ON public.invitation_codes FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "admins_delete_invitation_codes"
  ON public.invitation_codes FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_invitation_codes_updated_at ON public.invitation_codes;
CREATE TRIGGER trg_invitation_codes_updated_at
  BEFORE UPDATE ON public.invitation_codes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Activation RPC: called by service_role only (from server functions).
CREATE OR REPLACE FUNCTION public.activate_invitation_code(
  _code text,
  _user_id uuid,
  _full_name text,
  _phone text,
  _email text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv record;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO inv FROM public.invitation_codes WHERE code = _code FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;
  IF inv.status = 'revoked' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'revoked');
  END IF;
  IF inv.status = 'activated' OR inv.used_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_used');
  END IF;
  IF inv.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;

  -- Upsert profile with provided info
  INSERT INTO public.profiles (id, email, full_name, phone)
  VALUES (_user_id, _email, _full_name, _phone)
  ON CONFLICT (id) DO UPDATE
    SET full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        phone     = COALESCE(EXCLUDED.phone, public.profiles.phone),
        email     = COALESCE(EXCLUDED.email, public.profiles.email);

  -- Role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, inv.role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Link based on role
  IF inv.role = 'owner' AND inv.shop_id IS NOT NULL THEN
    UPDATE public.shops SET manager_id = _user_id WHERE id = inv.shop_id;
  END IF;

  IF inv.role = 'barber' AND inv.shop_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.barbers WHERE profile_id = _user_id AND shop_id = inv.shop_id) THEN
      INSERT INTO public.barbers (profile_id, shop_id, display_name_en, display_name_ar, status)
      VALUES (_user_id, inv.shop_id,
              COALESCE(_full_name, 'Barber'),
              COALESCE(_full_name, 'Barber'),
              'active');
    END IF;
  END IF;

  -- Mark code as used
  UPDATE public.invitation_codes
     SET status = 'activated',
         used_at = now(),
         activated_user_id = _user_id
   WHERE id = inv.id;

  -- Audit
  INSERT INTO public.audit_logs (actor_id, actor_email, action, target_type, target_id, details)
  VALUES (_user_id, _email, 'invitation_code.activated', 'invitation_code', inv.id::text,
          jsonb_build_object('role', inv.role, 'shop_id', inv.shop_id, 'code', inv.code));

  RETURN jsonb_build_object('ok', true, 'role', inv.role, 'shop_id', inv.shop_id);
END;
$$;

REVOKE ALL ON FUNCTION public.activate_invitation_code(text, uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.activate_invitation_code(text, uuid, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_invitation_code(text, uuid, text, text, text) TO service_role;
