
-- =====================================================================
-- 1. Convert has_role and is_super_admin to SECURITY INVOKER
-- =====================================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY INVOKER
 SET search_path = public
AS $function$
  SELECT COALESCE(_user_id = auth.uid(), false)
    AND EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND role = _role
    )
$function$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY INVOKER
 SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  );
$function$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, service_role;

-- =====================================================================
-- 2. Remove public RPC access to invite functions.
--    Replace with _user_id-parameterized variants callable only by service_role.
-- =====================================================================

-- Drop old signatures if present (they used auth.uid()).
DROP FUNCTION IF EXISTS public.accept_invite(text);
DROP FUNCTION IF EXISTS public.consume_invites_for_current_user();
DROP FUNCTION IF EXISTS public.get_invite_by_token(text);

-- New: accept_invite(_user_id, _token) — invoked by trusted backend.
CREATE OR REPLACE FUNCTION public.accept_invite(_user_id uuid, _token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  uid uuid := _user_id;
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
    IF NOT EXISTS (SELECT 1 FROM public.barbers WHERE profile_id = uid AND shop_id = inv.shop_id) THEN
      INSERT INTO public.barbers (profile_id, shop_id, display_name_en, display_name_ar, status)
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
$function$;

REVOKE EXECUTE ON FUNCTION public.accept_invite(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.accept_invite(uuid, text) TO service_role;

-- New: consume_invites_for_user(_user_id) — invoked by trusted backend.
CREATE OR REPLACE FUNCTION public.consume_invites_for_user(_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  uid uuid := _user_id;
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
      IF NOT EXISTS (SELECT 1 FROM public.barbers WHERE profile_id = uid AND shop_id = inv.shop_id) THEN
        INSERT INTO public.barbers (profile_id, shop_id, display_name_en, display_name_ar, status)
        SELECT uid,
               inv.shop_id,
               COALESCE(p.full_name, p.email),
               COALESCE(p.full_name, p.email),
               'active'
        FROM public.profiles p WHERE p.id = uid;
      END IF;
    END IF;

    UPDATE public.invites SET used_at = now(), status = 'accepted', accepted_at = now(), accepted_by = uid WHERE id = inv.id;
    applied := applied + 1;
  END LOOP;

  RETURN applied;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.consume_invites_for_user(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.consume_invites_for_user(uuid) TO service_role;

-- =====================================================================
-- 3. Fix platform_settings broad SELECT policy.
--    Expose only maintenance status via a view; admins keep full row access.
-- =====================================================================

DROP POLICY IF EXISTS "Authenticated users read maintenance only" ON public.platform_settings;

-- View exposes ONLY the maintenance JSON (and id) — no auth/general/notifications data.
CREATE OR REPLACE VIEW public.platform_maintenance_status
WITH (security_invoker = off) AS
SELECT id, maintenance
FROM public.platform_settings
WHERE id = 1;

GRANT SELECT ON public.platform_maintenance_status TO anon, authenticated;
