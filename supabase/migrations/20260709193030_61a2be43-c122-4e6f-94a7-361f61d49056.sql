-- Restore table-level grants to reviews (were revoked in prior security migration).
-- RLS policies already restrict row access; grants are needed to reach the table at all.
GRANT SELECT ON public.reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;