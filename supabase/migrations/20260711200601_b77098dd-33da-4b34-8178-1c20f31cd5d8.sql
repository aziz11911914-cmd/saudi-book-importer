-- Fix infinite recursion in user_roles policy.
-- has_role() must be SECURITY DEFINER so RLS policies that call it
-- do not re-trigger user_roles policies (which themselves may call has_role).
ALTER FUNCTION public.has_role(uuid, app_role) SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, anon;

-- Replace the self-referencing user_roles policy with a has_role() check.
DROP POLICY IF EXISTS "Super admins read all roles" ON public.user_roles;
CREATE POLICY "Super admins read all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));