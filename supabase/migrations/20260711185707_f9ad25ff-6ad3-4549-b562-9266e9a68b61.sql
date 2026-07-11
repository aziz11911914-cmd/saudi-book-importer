
-- 1) is_super_admin: switch to SECURITY INVOKER (only reads caller's own user_roles row)
ALTER FUNCTION public.is_super_admin() SECURITY INVOKER;

-- 2) get_maintenance_status: expose via a narrow view instead of a SECURITY DEFINER RPC
CREATE OR REPLACE VIEW public.maintenance_status_v AS
  SELECT maintenance FROM public.platform_settings WHERE id = 1;
GRANT SELECT ON public.maintenance_status_v TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_maintenance_status() FROM anon, authenticated, PUBLIC;

-- 3) Shops: stop exposing contact fields to anon via the raw table.
-- Public clients already read through the shops_public view which honours display_* flags.
DROP POLICY IF EXISTS "Active shops are public" ON public.shops;
CREATE POLICY "Active shops are public (authenticated)"
  ON public.shops FOR SELECT
  TO authenticated
  USING (status = 'active'::entity_status);
REVOKE SELECT ON public.shops FROM anon;
GRANT SELECT ON public.shops_public TO anon, authenticated;
