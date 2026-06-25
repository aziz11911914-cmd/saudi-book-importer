-- Fix invite RPCs: the barbers table uses `profile_id`, not `user_id`.
CREATE OR REPLACE FUNCTION public.consume_invites_for_current_user()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

CREATE OR REPLACE FUNCTION public.accept_invite(_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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