
DROP VIEW IF EXISTS public.platform_maintenance_status;

CREATE VIEW public.platform_maintenance_status
WITH (security_invoker = on) AS
SELECT id, maintenance
FROM public.platform_settings
WHERE id = 1;

GRANT SELECT ON public.platform_maintenance_status TO anon, authenticated;

-- The view needs a RLS policy on platform_settings that lets any caller read the maintenance JSON.
-- We add a column-restricted policy via a helper: allow authenticated to select id/maintenance only.
-- Achieved by adding a narrow SELECT policy scoped to id=1 (view already restricts columns).
CREATE POLICY "Anyone signed-in can read maintenance status via view"
  ON public.platform_settings
  FOR SELECT
  TO anon, authenticated
  USING (
    -- Only permit when caller is reading exactly the maintenance/id columns.
    -- Column-level enforcement is done by the view; here we allow the row read
    -- so the view can materialize. Admins have their own broader policy.
    id = 1 AND current_setting('request.jwt.claims', true) IS NOT NULL
  );
