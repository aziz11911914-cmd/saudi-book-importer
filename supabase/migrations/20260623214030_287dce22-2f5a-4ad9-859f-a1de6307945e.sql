
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT;

-- Backfill first_name/last_name from existing full_name where possible
UPDATE public.profiles p
SET first_name = COALESCE(p.first_name, NULLIF(split_part(p.full_name, ' ', 1), '')),
    last_name  = COALESCE(p.last_name,  NULLIF(NULLIF(substring(p.full_name from position(' ' in p.full_name) + 1), p.full_name), ''))
WHERE p.full_name IS NOT NULL AND p.full_name <> '';

-- Backfill email from auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE u.id = p.id AND p.email IS NULL;

-- Update the new-user trigger to populate first_name/last_name/email from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first text := NULLIF(NEW.raw_user_meta_data->>'first_name', '');
  v_last  text := NULLIF(NEW.raw_user_meta_data->>'last_name', '');
  v_full  text := NULLIF(NEW.raw_user_meta_data->>'full_name', '');
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, full_name, locale)
  VALUES (
    NEW.id,
    NEW.email,
    v_first,
    v_last,
    COALESCE(v_full, trim(concat_ws(' ', v_first, v_last))),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'locale', ''), 'ar')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'customer')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;
