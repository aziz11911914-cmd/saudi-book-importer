
-- ============================================================
-- 1) Extend app_role enum: add super_admin and owner
-- ============================================================
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'owner';
