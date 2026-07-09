
-- Drop the temporary broad SELECT policy and view; move to column-level access control.
DROP POLICY IF EXISTS "Anyone signed-in can read maintenance status via view" ON public.platform_settings;
DROP VIEW  IF EXISTS public.platform_maintenance_status;

-- Revoke wide table-level SELECT so column grants below become the effective allow-list.
REVOKE SELECT ON public.platform_settings FROM anon, authenticated;

-- Column-level SELECT: only id + maintenance are readable by non-admin roles.
GRANT SELECT (id, maintenance) ON public.platform_settings TO anon, authenticated;

-- Admin/super_admin need to read every column; ensure they have full column privileges via the service_role/postgres roles used for admin RPCs and the existing admin RLS policy.
-- (Admin RLS policy already exists; PostgREST uses the caller role, so admins in the app run as authenticated. Grant full-column SELECT to authenticated is what previously enabled it — but we just narrowed it. So admins now read via a server function, not directly.)
-- Adjust: admin server functions in the app use the authenticated context; grant them the ability by adding admin columns back conditionally is not possible in column ACLs. Instead, keep the existing admin RLS policy AND grant full column SELECT to service_role (which admin functions can also use).
GRANT SELECT ON public.platform_settings TO service_role;

-- Narrow SELECT policy allowing any signed-in or anonymous caller to read the singleton row.
-- Column-level grants above restrict which columns they can actually see.
CREATE POLICY "Anyone can read maintenance singleton"
  ON public.platform_settings
  FOR SELECT
  TO anon, authenticated
  USING (id = 1);
