
-- Restrict shops.phone to authenticated users only
REVOKE SELECT (phone) ON public.shops FROM anon;

-- Revoke direct EXECUTE on trigger-only functions (they still run as triggers)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_booking_overlap() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recompute_barber_rating() FROM anon, authenticated, PUBLIC;
