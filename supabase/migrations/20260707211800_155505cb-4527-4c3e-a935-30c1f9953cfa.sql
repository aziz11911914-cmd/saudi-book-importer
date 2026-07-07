
-- 1) Revoke anon/authenticated EXECUTE from internal SECURITY DEFINER helpers
--    They are used from within RLS/triggers/other definer functions, which run
--    with the owner's privileges and do not need caller-side EXECUTE grants.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM PUBLIC, anon, authenticated;

-- 2) Lock down audit_logs inserts: only trusted server-side paths may write.
DROP POLICY IF EXISTS "Authenticated users can insert their own audit rows" ON public.audit_logs;
-- No INSERT policy for authenticated/anon => all client-side inserts are denied.
-- Existing SECURITY DEFINER functions (e.g. handle_new_user, accept_invite,
-- consume_invites_for_current_user) and the service_role continue to write.

-- 3) Prevent customers (and other booking parties) from tampering with
--    protected columns via direct updates. Only service_role bypasses this.
CREATE OR REPLACE FUNCTION public.bookings_prevent_protected_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  is_staff boolean := false;
BEGIN
  -- service_role / postgres bypass entirely
  IF current_user IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  -- Determine if caller is staff for this booking (barber/owner/admin)
  SELECT
    EXISTS (SELECT 1 FROM public.barbers b
             WHERE b.id = NEW.barber_id AND b.profile_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.shops s
                WHERE s.id = NEW.shop_id AND s.manager_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles ur
                WHERE ur.user_id = auth.uid()
                  AND ur.role IN ('admin','super_admin'))
  INTO is_staff;

  IF is_staff THEN
    -- Staff may change status, price, cancellation fields, notes, etc.
    -- Still block changes to immutable identity columns.
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
       OR NEW.shop_id IS DISTINCT FROM OLD.shop_id
       OR NEW.booking_ref IS DISTINCT FROM OLD.booking_ref
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Immutable booking columns cannot be modified';
    END IF;
    RETURN NEW;
  END IF;

  -- Non-staff caller (the customer). Only allow safe columns to change.
  IF NEW.price_sar IS DISTINCT FROM OLD.price_sar
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.barber_id IS DISTINCT FROM OLD.barber_id
     OR NEW.service_id IS DISTINCT FROM OLD.service_id
     OR NEW.shop_id IS DISTINCT FROM OLD.shop_id
     OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
     OR NEW.starts_at IS DISTINCT FROM OLD.starts_at
     OR NEW.ends_at IS DISTINCT FROM OLD.ends_at
     OR NEW.duration_min IS DISTINCT FROM OLD.duration_min
     OR NEW.booking_ref IS DISTINCT FROM OLD.booking_ref
     OR NEW.cancelled_by IS DISTINCT FROM OLD.cancelled_by
     OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Customers cannot modify protected booking fields';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.bookings_prevent_protected_updates() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS bookings_prevent_protected_updates ON public.bookings;
CREATE TRIGGER bookings_prevent_protected_updates
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.bookings_prevent_protected_updates();
