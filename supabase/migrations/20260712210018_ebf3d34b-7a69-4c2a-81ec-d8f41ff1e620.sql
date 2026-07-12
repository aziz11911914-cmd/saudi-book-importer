
ALTER TABLE public.barbers ADD COLUMN IF NOT EXISTS appointment_duration_min integer NOT NULL DEFAULT 30;
ALTER TABLE public.barber_availability ADD COLUMN IF NOT EXISTS break_start time;
ALTER TABLE public.barber_availability ADD COLUMN IF NOT EXISTS break_end time;
ALTER TABLE public.barber_availability ADD COLUMN IF NOT EXISTS is_off boolean NOT NULL DEFAULT false;
