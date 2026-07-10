
DROP POLICY IF EXISTS "Anyone can read maintenance singleton" ON public.platform_settings;

CREATE OR REPLACE FUNCTION public.get_maintenance_status()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT maintenance FROM public.platform_settings WHERE id = 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_maintenance_status() TO anon, authenticated;
