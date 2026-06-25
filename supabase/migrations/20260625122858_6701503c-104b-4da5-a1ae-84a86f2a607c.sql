
-- Protect the platform super admin role from accidental removal,
-- and ensure the role is always (re)granted whenever the protected
-- account signs up or signs in.

CREATE OR REPLACE FUNCTION public.protect_super_admin_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  protected_email constant text := 'abdulazizalodan1@gmail.com';
  target_email text;
BEGIN
  IF TG_OP = 'DELETE' AND OLD.role = 'super_admin' THEN
    SELECT lower(email) INTO target_email FROM auth.users WHERE id = OLD.user_id;
    IF target_email = protected_email THEN
      RAISE EXCEPTION 'Cannot remove super_admin role from the platform owner account';
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS protect_super_admin_role_trg ON public.user_roles;
CREATE TRIGGER protect_super_admin_role_trg
  BEFORE DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.protect_super_admin_role();

-- Ensure the protected account always has the super_admin role on sign-in
CREATE OR REPLACE FUNCTION public.ensure_protected_super_admin(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uemail text;
BEGIN
  SELECT lower(email) INTO uemail FROM auth.users WHERE id = _user_id;
  IF uemail = 'abdulazizalodan1@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END;
$$;

-- Wire it into the existing invite-consuming RPC so it runs on every sign-in
CREATE OR REPLACE FUNCTION public.consume_invites_for_current_user()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  uemail text;
  inv record;
  applied int := 0;
BEGIN
  IF uid IS NULL THEN RETURN 0; END IF;

  SELECT lower(email) INTO uemail FROM auth.users WHERE id = uid;
  IF uemail IS NULL THEN RETURN 0; END IF;

  UPDATE public.profiles SET last_login_at = now() WHERE id = uid;

  PERFORM public.ensure_protected_super_admin(uid);

  FOR inv IN
    SELECT * FROM public.invites
    WHERE lower(email) = uemail
      AND used_at IS NULL
      AND expires_at > now()
    ORDER BY created_at ASC
  LOOP
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
               COALESCE(p.full_name, p.email),
               COALESCE(p.full_name, p.email),
               'active'
        FROM public.profiles p WHERE p.id = uid;
      END IF;
    END IF;

    UPDATE public.invites SET used_at = now() WHERE id = inv.id;
    applied := applied + 1;
  END LOOP;

  RETURN applied;
END;
$$;

-- Backfill: make sure the protected account currently has the role
DO $$
DECLARE
  uid uuid;
BEGIN
  SELECT id INTO uid FROM auth.users WHERE lower(email) = 'abdulazizalodan1@gmail.com' LIMIT 1;
  IF uid IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;
