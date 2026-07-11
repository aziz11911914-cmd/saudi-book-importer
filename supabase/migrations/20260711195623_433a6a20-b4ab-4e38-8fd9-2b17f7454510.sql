-- Restore EXECUTE on is_super_admin() for authenticated users.
-- Many RLS policies (on profiles, user_roles, shops, barbers, etc.) call this
-- SECURITY DEFINER function; without EXECUTE, every authenticated read fails
-- with "permission denied for function is_super_admin".
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;