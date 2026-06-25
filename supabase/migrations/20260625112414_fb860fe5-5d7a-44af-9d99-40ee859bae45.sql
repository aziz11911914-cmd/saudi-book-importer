
-- Review moderation
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS hidden_at timestamptz;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS hidden_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Booking moderation
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS cancel_reason text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

-- Invites table indexes + ensure RLS sane
CREATE INDEX IF NOT EXISTS invites_email_idx ON public.invites (lower(email)) WHERE used_at IS NULL;

-- Allow super admin to manage invites
DROP POLICY IF EXISTS "Super admin manages invites" ON public.invites;
CREATE POLICY "Super admin manages invites" ON public.invites
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- consume_invites: called on sign-in to apply any pending invites for the current user's email.
-- Assigns roles, optionally links the user to a shop (owner) or creates a barber row.
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

  -- always update last_login
  UPDATE public.profiles SET last_login_at = now() WHERE id = uid;

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
      -- create barber row if none exists for this user/shop yet
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

REVOKE EXECUTE ON FUNCTION public.consume_invites_for_current_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_invites_for_current_user() TO authenticated, service_role;
