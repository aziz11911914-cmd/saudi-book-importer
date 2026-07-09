
-- Extend profile_status enum for full user management
ALTER TYPE public.profile_status ADD VALUE IF NOT EXISTS 'disabled';
ALTER TYPE public.profile_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE public.profile_status ADD VALUE IF NOT EXISTS 'deleted';

-- Soft delete + disable metadata on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS disabled_reason text;
