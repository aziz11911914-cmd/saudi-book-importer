
-- 1. Revoke phone column from anonymous users on shops
REVOKE SELECT (phone) ON public.shops FROM anon;

-- 2. Restrict reviews customer_id from anon by splitting policies
DROP POLICY IF EXISTS "Reviews are publicly readable" ON public.reviews;
DROP POLICY IF EXISTS "reviews_select_public" ON public.reviews;
DROP POLICY IF EXISTS "Anyone can read reviews" ON public.reviews;

CREATE POLICY "reviews_select_authenticated" ON public.reviews
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "reviews_select_anon_no_customer" ON public.reviews
  FOR SELECT TO anon USING (true);

REVOKE SELECT (customer_id) ON public.reviews FROM anon;

-- 3. Add admin DELETE policy on bookings
CREATE POLICY "Admins can delete bookings" ON public.bookings
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
