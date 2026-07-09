
CREATE OR REPLACE FUNCTION public.generate_unique_barber_slug(_base text)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
DECLARE
  base text;
  candidate text;
  i int := 0;
BEGIN
  base := lower(regexp_replace(coalesce(_base,''), '[^a-z0-9]+', '-', 'gi'));
  base := regexp_replace(base, '(^-+|-+$)', '', 'g');
  IF length(base) = 0 THEN base := 'barber'; END IF;
  candidate := base;
  WHILE EXISTS (SELECT 1 FROM public.barbers WHERE slug = candidate) LOOP
    i := i + 1;
    candidate := base || '-' || i::text;
  END LOOP;
  RETURN candidate;
END;
$$;
