
-- Recreate the maintenance view without SECURITY DEFINER.
DROP VIEW IF EXISTS public.maintenance_status_v;
CREATE VIEW public.maintenance_status_v
WITH (security_invoker = on)
AS SELECT maintenance FROM public.platform_settings WHERE id = 1;

GRANT SELECT ON public.maintenance_status_v TO anon, authenticated;

-- Column-level privilege: anon/auth can ONLY read the `maintenance` column.
-- All other columns (contact info, OTP config, notifications, etc.) remain inaccessible
-- even if a future policy widened row visibility.
GRANT SELECT (maintenance) ON public.platform_settings TO anon, authenticated;

-- Narrow RLS policy: only the singleton row (id = 1) is visible to callers,
-- and even then only the maintenance column can be projected due to the
-- column-level grants above.
DROP POLICY IF EXISTS "Public can read maintenance flag" ON public.platform_settings;
CREATE POLICY "Public can read maintenance flag"
  ON public.platform_settings FOR SELECT
  TO anon, authenticated
  USING (id = 1);
