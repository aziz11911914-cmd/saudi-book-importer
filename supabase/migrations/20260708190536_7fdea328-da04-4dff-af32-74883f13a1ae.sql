-- Restore EXECUTE on RLS helper functions.
-- These security definer helpers are referenced by RLS policies (e.g. profiles
-- "Admins read all profiles"), so the invoking role must be able to execute them.
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;