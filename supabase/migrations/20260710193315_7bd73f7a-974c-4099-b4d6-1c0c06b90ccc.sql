-- Fix infinite recursion in RLS: is_super_admin must be SECURITY DEFINER
-- so it can read user_roles without re-triggering user_roles RLS policies
-- (which themselves call is_super_admin).
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin() TO anon, authenticated;