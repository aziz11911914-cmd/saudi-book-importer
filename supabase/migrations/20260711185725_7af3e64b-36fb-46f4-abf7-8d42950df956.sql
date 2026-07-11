
ALTER VIEW public.maintenance_status_v SET (security_invoker = on);

-- Allow anon/authenticated to read only the maintenance column of the settings row
GRANT SELECT (maintenance) ON public.platform_settings TO anon, authenticated;

CREATE POLICY "Public can read maintenance flag"
  ON public.platform_settings FOR SELECT
  TO anon, authenticated
  USING (id = 1);
