ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'salon_owner';

CREATE TABLE IF NOT EXISTS public.auth_otp_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  user_id UUID,
  code_hash TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  verification_type TEXT NOT NULL CHECK (verification_type IN ('signup', 'magiclink', 'recovery', 'invite', 'email_change', 'reauthentication', 'email')),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.auth_otp_challenges TO service_role;

ALTER TABLE public.auth_otp_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage OTP challenges" ON public.auth_otp_challenges;
CREATE POLICY "Service role can manage OTP challenges"
  ON public.auth_otp_challenges
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_auth_otp_challenges_email_created
  ON public.auth_otp_challenges (email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_otp_challenges_active
  ON public.auth_otp_challenges (email, expires_at DESC)
  WHERE consumed_at IS NULL AND revoked_at IS NULL;