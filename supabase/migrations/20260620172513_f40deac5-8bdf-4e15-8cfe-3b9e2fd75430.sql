
-- ============== DEMO REVIEWS (display-only, no auth FK) ==============
CREATE TABLE IF NOT EXISTS public.demo_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  barber_id UUID REFERENCES public.barbers(id) ON DELETE CASCADE,
  reviewer_name TEXT NOT NULL,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.demo_reviews TO anon, authenticated;
GRANT ALL ON public.demo_reviews TO service_role;
ALTER TABLE public.demo_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Demo reviews public" ON public.demo_reviews
  FOR SELECT TO anon, authenticated USING (true);

-- ============== NEW SHOPS ==============
INSERT INTO public.shops (id, slug, name_en, name_ar, description_en, description_ar, cover_url, lat, lng, address, city, district, phone, status, featured, rating_avg, rating_count) VALUES
('11111111-1111-1111-1111-111111111112', 'pointcut-barbershop', 'Pointcut Barbershop', 'بوينت كت للحلاقة',
 'A brick-and-stone barbershop in Ar Rayyan blending classic technique with modern fades. Eight chairs, espresso bar, and a quiet beard lounge.',
 'صالون حلاقة عصري في الريان يجمع الأساليب الكلاسيكية مع أحدث صيحات التدرج. ثمانية كراسي، ركن قهوة، وغرفة هادئة للعناية باللحية.',
 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=1800&q=80',
 24.7270, 46.5860, 'Olaya St, Ar Rayyan', 'Riyadh', 'Ar Rayyan', '+966 11 555 0102', 'active', true, 4.8, 2289),
('11111111-1111-1111-1111-111111111113', 'royal-cuts', 'Royal Cuts', 'رويال كَتس',
 'A premium gentlemen''s grooming destination in Al Olaya. Hot towel shaves, signature scalp treatments, and master barbers.',
 'وجهة العناية الفاخرة بالرجال في العليا. حلاقة بمنشفة ساخنة، علاجات فروة الرأس، وحلاقين متمكنين.',
 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=1800&q=80',
 24.6920, 46.6850, 'King Fahd Rd, Al Olaya', 'Riyadh', 'Al Olaya', '+966 11 555 0103', 'active', true, 4.7, 1842),
('11111111-1111-1111-1111-111111111114', 'diwan-lounge', 'Diwan Grooming Lounge', 'ديوان لاونج للعناية',
 'A modern majlis-inspired grooming lounge in An Nakheel. Quiet, member-style service, with arabica oud diffusers and bespoke beard sculpting.',
 'صالون عناية مستلهم من الديوان في حي النخيل. خدمة هادئة بأسلوب الأعضاء مع عطور العود ونحت اللحية بأسلوبك.',
 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=1800&q=80',
 24.7820, 46.6420, 'Anas Bin Malik Rd, An Nakheel', 'Riyadh', 'An Nakheel', '+966 11 555 0104', 'active', false, 4.9, 967),
('11111111-1111-1111-1111-111111111115', 'velocity-studio', 'Velocity Studio', 'فيلوسيتي ستوديو',
 'A youth-forward barber studio in Al Malqa specializing in skin fades, textured crops, and creative line work.',
 'استوديو حلاقة للشباب في حي الملقا متخصص في التدرج الجلدي، القصات النصية، والخطوط الإبداعية.',
 'https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=1800&q=80',
 24.8160, 46.6090, 'King Khalid Branch Rd, Al Malqa', 'Riyadh', 'Al Malqa', '+966 11 555 0105', 'active', true, 4.6, 1521)
ON CONFLICT (id) DO NOTHING;

-- Update The Address description if empty + add cover
UPDATE public.shops SET
  description_en = COALESCE(description_en, 'A retreat for the modern gentleman: The Address combines elegance with specialized barbering in a refined environment. Master barbers handle everything from classic cuts to refreshing facial treatments, with strict attention to cleanliness and comfort.'),
  description_ar = COALESCE(description_ar, 'ملاذ للرجال العصريين، يجمع "صالون العنوان" بين الأناقة والخدمات المتخصصة في الحلاقة في بيئة أنيقة. يتخصص الحلاقون المهرة في كل شيء من القصات الكلاسيكية إلى العلاجات المنعشة للوجه، مع ضمان تنفيذ كل التفاصيل بدقة، مع التزامنا بالنظافة والراحة.')
WHERE id = '11111111-1111-1111-1111-111111111111';

-- ============== SHOP HOURS (open daily 10:00-23:30) ==============
INSERT INTO public.shop_hours (shop_id, day_of_week, opens_at, closes_at)
SELECT s.id, dow, '10:00'::time, '23:30'::time
FROM public.shops s, generate_series(0,6) AS dow
WHERE s.id IN (
  '11111111-1111-1111-1111-111111111112',
  '11111111-1111-1111-1111-111111111113',
  '11111111-1111-1111-1111-111111111114',
  '11111111-1111-1111-1111-111111111115'
)
ON CONFLICT DO NOTHING;

-- ============== SHOP PHOTOS (gallery) ==============
INSERT INTO public.shop_photos (shop_id, url, sort) VALUES
-- Pointcut
('11111111-1111-1111-1111-111111111112', 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=1400&q=80', 0),
('11111111-1111-1111-1111-111111111112', 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=1400&q=80', 1),
('11111111-1111-1111-1111-111111111112', 'https://images.unsplash.com/photo-1622287162716-f311baa1a2b8?w=1400&q=80', 2),
('11111111-1111-1111-1111-111111111112', 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=1400&q=80', 3),
-- Royal Cuts
('11111111-1111-1111-1111-111111111113', 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=1400&q=80', 0),
('11111111-1111-1111-1111-111111111113', 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=1400&q=80', 1),
('11111111-1111-1111-1111-111111111113', 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=1400&q=80', 2),
('11111111-1111-1111-1111-111111111113', 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=1400&q=80', 3),
-- Diwan
('11111111-1111-1111-1111-111111111114', 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=1400&q=80', 0),
('11111111-1111-1111-1111-111111111114', 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=1400&q=80', 1),
('11111111-1111-1111-1111-111111111114', 'https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=1400&q=80', 2),
('11111111-1111-1111-1111-111111111114', 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=1400&q=80', 3),
-- Velocity
('11111111-1111-1111-1111-111111111115', 'https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=1400&q=80', 0),
('11111111-1111-1111-1111-111111111115', 'https://images.unsplash.com/photo-1622287162716-f311baa1a2b8?w=1400&q=80', 1),
('11111111-1111-1111-1111-111111111115', 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=1400&q=80', 2),
('11111111-1111-1111-1111-111111111115', 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=1400&q=80', 3);

-- Add some gallery photos to The Address
INSERT INTO public.shop_photos (shop_id, url, sort) VALUES
('11111111-1111-1111-1111-111111111111', 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=1400&q=80', 1),
('11111111-1111-1111-1111-111111111111', 'https://images.unsplash.com/photo-1622287162716-f311baa1a2b8?w=1400&q=80', 2),
('11111111-1111-1111-1111-111111111111', 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=1400&q=80', 3);

-- ============== SERVICES ==============
-- Pointcut services
INSERT INTO public.services (id, shop_id, name_en, name_ar, description_en, description_ar, price_sar, duration_min, category) VALUES
('33333333-3333-3333-3333-333333330201', '11111111-1111-1111-1111-111111111112', 'Signature Haircut', 'قصة بوينت كت المميزة', 'Consultation, wash, precision cut and style.', 'استشارة، غسيل، قصة دقيقة وتصفيف.', 65, 30, 'hair'),
('33333333-3333-3333-3333-333333330202', '11111111-1111-1111-1111-111111111112', 'Skin Fade', 'تدرج جلدي', 'A zero-blend skin fade with razor finish.', 'تدرج جلدي بدمج كامل وحلاقة بالموس.', 75, 35, 'hair'),
('33333333-3333-3333-3333-333333330203', '11111111-1111-1111-1111-111111111112', 'Beard Sculpt', 'نحت اللحية', 'Hot-towel shave and beard line-up.', 'حلاقة بمنشفة ساخنة وتحديد اللحية.', 45, 25, 'beard'),
('33333333-3333-3333-3333-333333330204', '11111111-1111-1111-1111-111111111112', 'Cut + Beard Combo', 'قصة + لحية', 'Full haircut and beard styling package.', 'قصة شعر كاملة مع تنسيق اللحية.', 110, 55, 'package'),
-- Royal Cuts services
('33333333-3333-3333-3333-333333330301', '11111111-1111-1111-1111-111111111113', 'Royal Cut', 'القصة الملكية', 'Master-barber haircut, scalp massage, finishing pomade.', 'قصة شعر بيد حلاق محترف، تدليك فروة الرأس، وتثبيت.', 120, 45, 'hair'),
('33333333-3333-3333-3333-333333330302', '11111111-1111-1111-1111-111111111113', 'Hot Towel Shave', 'حلاقة بالمنشفة الساخنة', 'Traditional straight-razor shave with hot towel.', 'حلاقة تقليدية بالموس مع منشفة ساخنة.', 80, 35, 'beard'),
('33333333-3333-3333-3333-333333330303', '11111111-1111-1111-1111-111111111113', 'Royal Package', 'الباقة الملكية', 'Haircut + shave + facial + scalp treatment.', 'قصة شعر + حلاقة + تنظيف بشرة + علاج فروة.', 240, 90, 'package'),
('33333333-3333-3333-3333-333333330304', '11111111-1111-1111-1111-111111111113', 'Taper Fade', 'تدرج خفيف', 'Soft taper for a polished, business look.', 'تدرج هادئ للحصول على مظهر أنيق.', 95, 35, 'hair'),
-- Diwan services
('33333333-3333-3333-3333-333333330401', '11111111-1111-1111-1111-111111111114', 'Diwan Signature', 'قصة الديوان المميزة', 'Bespoke consultation and tailored haircut.', 'استشارة مخصصة وقصة شعر مصممة لك.', 140, 45, 'hair'),
('33333333-3333-3333-3333-333333330402', '11111111-1111-1111-1111-111111111114', 'Oud Beard Ritual', 'طقوس العود للحية', 'Beard trim, oud-infused oils, hot towel finish.', 'تنسيق اللحية، زيوت العود، وتشطيب بالمنشفة الساخنة.', 90, 30, 'beard'),
('33333333-3333-3333-3333-333333330403', '11111111-1111-1111-1111-111111111114', 'Majlis Package', 'باقة المجلس', 'Cut, beard, facial, and Arabic coffee service.', 'قصة، لحية، تنظيف بشرة، وقهوة عربية.', 280, 90, 'package'),
-- Velocity services
('33333333-3333-3333-3333-333333330501', '11111111-1111-1111-1111-111111111115', 'Skin Fade Pro', 'تدرج جلدي احترافي', 'Sharp zero-fade with detailed line work.', 'تدرج صفر حاد مع تفاصيل الخطوط.', 70, 40, 'hair'),
('33333333-3333-3333-3333-333333330502', '11111111-1111-1111-1111-111111111115', 'French Crop', 'فرنش كروب', 'Textured French crop with fringe styling.', 'فرنش كروب نصي مع تصفيف الغرة.', 75, 35, 'hair'),
('33333333-3333-3333-3333-333333330503', '11111111-1111-1111-1111-111111111115', 'Buzz Cut', 'قصة بوز', 'Clean buzz cut, all guards available.', 'قصة بوز نظيفة، جميع المقاسات متاحة.', 40, 20, 'hair'),
('33333333-3333-3333-3333-333333330504', '11111111-1111-1111-1111-111111111115', 'Beard Line Up', 'تحديد اللحية', 'Crisp beard line-up and edge work.', 'تحديد اللحية بدقة مع رسم الحواف.', 50, 25, 'beard');

-- ============== BARBERS ==============
INSERT INTO public.barbers (id, shop_id, slug, display_name_en, display_name_ar, title_en, title_ar, bio_en, bio_ar, photo_url, years_experience, status, rating_avg, rating_count, appointments_completed, clients_served, featured) VALUES
-- Pointcut
('22222222-2222-2222-2222-222222220201', '11111111-1111-1111-1111-111111111112', 'omar-pointcut', 'Omar Hassan', 'عمر حسن', 'Senior Barber', 'حلاق رئيسي', 'Twelve years of fades and shears work.', 'اثنا عشر عامًا في فنون التدرج والمقص.', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&q=80', 12, 'active', 4.9, 612, 1840, 740, true),
('22222222-2222-2222-2222-222222220202', '11111111-1111-1111-1111-111111111112', 'khaled-pointcut', 'Khaled Al-Mansour', 'خالد المنصور', 'Barber', 'حلاق', 'Specialist in skin fades and textured cuts.', 'متخصص في التدرج الجلدي والقصات النصية.', 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=600&q=80', 7, 'active', 4.8, 421, 1120, 502, false),
('22222222-2222-2222-2222-222222220203', '11111111-1111-1111-1111-111111111112', 'youssef-pointcut', 'Youssef Karim', 'يوسف كريم', 'Barber', 'حلاق', 'Beard sculpting and classic cuts.', 'نحت اللحية والقصات الكلاسيكية.', 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=600&q=80', 5, 'active', 4.7, 312, 780, 388, false),
-- Royal Cuts
('22222222-2222-2222-2222-222222220301', '11111111-1111-1111-1111-111111111113', 'fares-royal', 'Fares Al-Otaibi', 'فارس العتيبي', 'Master Barber', 'حلاق محترف', 'Royal Cuts master, fifteen years experience.', 'حلاق رئيسي في رويال كَتس، خمسة عشر عامًا من الخبرة.', 'https://images.unsplash.com/photo-1506634572416-48cdfe530110?w=600&q=80', 15, 'active', 5.0, 540, 2100, 880, true),
('22222222-2222-2222-2222-222222220302', '11111111-1111-1111-1111-111111111113', 'tariq-royal', 'Tariq Al-Saud', 'طارق السعود', 'Senior Barber', 'حلاق رئيسي', 'Hot towel shaves and luxury treatments.', 'حلاقة بالمنشفة الساخنة والعلاجات الفاخرة.', 'https://images.unsplash.com/photo-1542327897-d73f4005b533?w=600&q=80', 10, 'active', 4.8, 380, 1480, 612, false),
('22222222-2222-2222-2222-222222220303', '11111111-1111-1111-1111-111111111113', 'majid-royal', 'Majid Al-Harbi', 'ماجد الحربي', 'Barber', 'حلاق', 'Polished business cuts and taper fades.', 'قصات الأعمال الأنيقة والتدرج الخفيف.', 'https://images.unsplash.com/photo-1582015752624-e8b1c75e3711?w=600&q=80', 6, 'active', 4.6, 220, 690, 310, false),
-- Diwan
('22222222-2222-2222-2222-222222220401', '11111111-1111-1111-1111-111111111114', 'salem-diwan', 'Salem Bin Rashid', 'سالم بن راشد', 'Master Barber', 'حلاق محترف', 'Bespoke consultations and beard rituals.', 'استشارات مخصصة وطقوس العناية باللحية.', 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=600&q=80', 14, 'active', 5.0, 410, 1680, 720, true),
('22222222-2222-2222-2222-222222220402', '11111111-1111-1111-1111-111111111114', 'rashed-diwan', 'Rashed Al-Qahtani', 'راشد القحطاني', 'Senior Barber', 'حلاق رئيسي', 'Quiet, focused service for repeat clients.', 'خدمة هادئة ومركزة للعملاء الدائمين.', 'https://images.unsplash.com/photo-1559548331-f9cb98001426?w=600&q=80', 9, 'active', 4.9, 280, 1100, 450, false),
-- Velocity
('22222222-2222-2222-2222-222222220501', '11111111-1111-1111-1111-111111111115', 'nawaf-velocity', 'Nawaf Al-Anzi', 'نواف العنزي', 'Lead Barber', 'حلاق رئيسي', 'Skin fade specialist and creative line work.', 'متخصص التدرج الجلدي والخطوط الإبداعية.', 'https://images.unsplash.com/photo-1488161628813-04466f872be2?w=600&q=80', 8, 'active', 4.7, 510, 1620, 680, true),
('22222222-2222-2222-2222-222222220502', '11111111-1111-1111-1111-111111111115', 'sami-velocity', 'Sami Al-Dosari', 'سامي الدوسري', 'Barber', 'حلاق', 'Textured crops, fringes, and creative styling.', 'القصات النصية، الغرة، والتصفيف الإبداعي.', 'https://images.unsplash.com/photo-1521119989659-a83eee488004?w=600&q=80', 5, 'active', 4.5, 280, 740, 320, false),
('22222222-2222-2222-2222-222222220503', '11111111-1111-1111-1111-111111111115', 'badr-velocity', 'Badr Al-Mutairi', 'بدر المطيري', 'Barber', 'حلاق', 'Buzz cuts, beard line-ups, fast and clean.', 'قصات البوز وتحديد اللحية، سريع ونظيف.', 'https://images.unsplash.com/photo-1504257432389-52343af06ae3?w=600&q=80', 4, 'active', 4.6, 220, 580, 270, false)
ON CONFLICT (id) DO NOTHING;

-- ============== BARBER AVAILABILITY (daily 10:00-23:00) ==============
INSERT INTO public.barber_availability (barber_id, day_of_week, starts_at, ends_at)
SELECT b.id, dow, '10:00'::time, '23:00'::time
FROM public.barbers b, generate_series(0,6) AS dow
WHERE b.shop_id IN (
  '11111111-1111-1111-1111-111111111112',
  '11111111-1111-1111-1111-111111111113',
  '11111111-1111-1111-1111-111111111114',
  '11111111-1111-1111-1111-111111111115'
)
ON CONFLICT DO NOTHING;

-- ============== BARBER ↔ SERVICES (each barber offers all shop services) ==============
INSERT INTO public.barber_services (barber_id, service_id)
SELECT b.id, s.id
FROM public.barbers b
JOIN public.services s ON s.shop_id = b.shop_id
WHERE b.shop_id IN (
  '11111111-1111-1111-1111-111111111112',
  '11111111-1111-1111-1111-111111111113',
  '11111111-1111-1111-1111-111111111114',
  '11111111-1111-1111-1111-111111111115'
)
ON CONFLICT DO NOTHING;

-- ============== BARBER SPECIALTIES ==============
-- Map each barber to ~3 specialties
INSERT INTO public.barber_specialties (barber_id, specialty_id)
SELECT b.id, sp.id FROM public.barbers b, public.specialties sp
WHERE (b.id = '22222222-2222-2222-2222-222222220201' AND sp.slug IN ('fade','skin-fade','beard-styling'))
   OR (b.id = '22222222-2222-2222-2222-222222220202' AND sp.slug IN ('skin-fade','taper-fade','french-crop'))
   OR (b.id = '22222222-2222-2222-2222-222222220203' AND sp.slug IN ('beard-styling','fade','buzz-cut'))
   OR (b.id = '22222222-2222-2222-2222-222222220301' AND sp.slug IN ('fade','taper-fade','beard-styling'))
   OR (b.id = '22222222-2222-2222-2222-222222220302' AND sp.slug IN ('beard-styling','taper-fade'))
   OR (b.id = '22222222-2222-2222-2222-222222220303' AND sp.slug IN ('taper-fade','french-crop'))
   OR (b.id = '22222222-2222-2222-2222-222222220401' AND sp.slug IN ('beard-styling','fade','french-crop'))
   OR (b.id = '22222222-2222-2222-2222-222222220402' AND sp.slug IN ('taper-fade','beard-styling'))
   OR (b.id = '22222222-2222-2222-2222-222222220501' AND sp.slug IN ('skin-fade','fade','french-crop'))
   OR (b.id = '22222222-2222-2222-2222-222222220502' AND sp.slug IN ('french-crop','taper-fade'))
   OR (b.id = '22222222-2222-2222-2222-222222220503' AND sp.slug IN ('buzz-cut','beard-styling'))
ON CONFLICT DO NOTHING;

-- ============== PORTFOLIO PHOTOS ==============
INSERT INTO public.portfolio_photos (barber_id, url, caption_en, caption_ar, sort) VALUES
-- Pointcut
('22222222-2222-2222-2222-222222220201', 'https://images.unsplash.com/photo-1622287162716-f311baa1a2b8?w=900&q=80', 'Skin fade with texture top', 'تدرج جلدي مع تنسيق علوي', 1),
('22222222-2222-2222-2222-222222220201', 'https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=900&q=80', 'Classic taper fade', 'تدرج كلاسيكي', 2),
('22222222-2222-2222-2222-222222220201', 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=900&q=80', 'Beard sculpt', 'نحت اللحية', 3),
('22222222-2222-2222-2222-222222220202', 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=900&q=80', 'French crop', 'فرنش كروب', 1),
('22222222-2222-2222-2222-222222220202', 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=900&q=80', 'Skin fade detail', 'تفاصيل التدرج الجلدي', 2),
('22222222-2222-2222-2222-222222220203', 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=900&q=80', 'Buzz cut', 'قصة بوز', 1),
-- Royal Cuts
('22222222-2222-2222-2222-222222220301', 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=900&q=80', 'Royal taper', 'تدرج ملكي', 1),
('22222222-2222-2222-2222-222222220301', 'https://images.unsplash.com/photo-1521119989659-a83eee488004?w=900&q=80', 'Polished cut and shave', 'قصة وحلاقة أنيقة', 2),
('22222222-2222-2222-2222-222222220301', 'https://images.unsplash.com/photo-1506634572416-48cdfe530110?w=900&q=80', 'Master barber session', 'جلسة مع حلاق محترف', 3),
('22222222-2222-2222-2222-222222220302', 'https://images.unsplash.com/photo-1542327897-d73f4005b533?w=900&q=80', 'Hot towel shave', 'حلاقة بالمنشفة الساخنة', 1),
('22222222-2222-2222-2222-222222220303', 'https://images.unsplash.com/photo-1582015752624-e8b1c75e3711?w=900&q=80', 'Business taper', 'تدرج رجال الأعمال', 1),
-- Diwan
('22222222-2222-2222-2222-222222220401', 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=900&q=80', 'Bespoke cut', 'قصة مخصصة', 1),
('22222222-2222-2222-2222-222222220401', 'https://images.unsplash.com/photo-1559548331-f9cb98001426?w=900&q=80', 'Oud beard ritual', 'طقوس العود للحية', 2),
('22222222-2222-2222-2222-222222220401', 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=900&q=80', 'Diwan signature', 'قصة الديوان المميزة', 3),
('22222222-2222-2222-2222-222222220402', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=900&q=80', 'Tapered finish', 'تشطيب متدرج', 1),
-- Velocity
('22222222-2222-2222-2222-222222220501', 'https://images.unsplash.com/photo-1488161628813-04466f872be2?w=900&q=80', 'Skin fade pro', 'تدرج جلدي احترافي', 1),
('22222222-2222-2222-2222-222222220501', 'https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=900&q=80', 'Line work detail', 'تفاصيل الخطوط', 2),
('22222222-2222-2222-2222-222222220501', 'https://images.unsplash.com/photo-1521119989659-a83eee488004?w=900&q=80', 'Textured crop', 'قصة نصية', 3),
('22222222-2222-2222-2222-222222220502', 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=900&q=80', 'French crop', 'فرنش كروب', 1),
('22222222-2222-2222-2222-222222220502', 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=900&q=80', 'Fringe styling', 'تصفيف الغرة', 2),
('22222222-2222-2222-2222-222222220503', 'https://images.unsplash.com/photo-1504257432389-52343af06ae3?w=900&q=80', 'Buzz cut clean', 'بوز نظيف', 1);

-- ============== DEMO REVIEWS ==============
INSERT INTO public.demo_reviews (shop_id, barber_id, reviewer_name, rating, comment, created_at) VALUES
-- The Address
('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222201', 'Abdulrahman A.', 5, 'Mohammed is a true master. The skin fade was perfect and the beard work was top-notch.', now() - interval '3 days'),
('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222202', 'Faisal M.', 5, 'Ramadan was professional, clean, and finished exactly the look I wanted.', now() - interval '6 days'),
('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222203', 'Yousef K.', 4, 'Great cut, very friendly staff. The place is clean and the shop has a calm vibe.', now() - interval '11 days'),
('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222201', 'Sultan B.', 5, 'Best barber in Riyadh. Booked again immediately.', now() - interval '18 days'),
-- Pointcut
('11111111-1111-1111-1111-111111111112', '22222222-2222-2222-2222-222222220201', 'Mohammed K.', 5, 'Omar nailed the skin fade. Sharp lines and clean detail. Will be back.', now() - interval '2 days'),
('11111111-1111-1111-1111-111111111112', '22222222-2222-2222-2222-222222220202', 'Hisham F.', 5, 'Khaled understands textured cuts. Very precise.', now() - interval '5 days'),
('11111111-1111-1111-1111-111111111112', NULL, 'Saud T.', 4, 'Great atmosphere, espresso bar is a nice touch. Booking flow was smooth.', now() - interval '9 days'),
('11111111-1111-1111-1111-111111111112', '22222222-2222-2222-2222-222222220203', 'Anas D.', 5, 'Youssef did the cleanest beard sculpt I''ve had in years.', now() - interval '14 days'),
-- Royal Cuts
('11111111-1111-1111-1111-111111111113', '22222222-2222-2222-2222-222222220301', 'Khalid N.', 5, 'Fares is a master. The hot towel shave was incredible.', now() - interval '1 day'),
('11111111-1111-1111-1111-111111111113', '22222222-2222-2222-2222-222222220302', 'Bader H.', 5, 'Tariq made the royal package feel truly premium.', now() - interval '4 days'),
('11111111-1111-1111-1111-111111111113', '22222222-2222-2222-2222-222222220303', 'Yahya M.', 4, 'Polished business cut. Booking was straightforward.', now() - interval '10 days'),
-- Diwan
('11111111-1111-1111-1111-111111111114', '22222222-2222-2222-2222-222222220401', 'Abdulaziz R.', 5, 'Salem''s bespoke cut is unmatched. The oud beard ritual is unique.', now() - interval '3 days'),
('11111111-1111-1111-1111-111111111114', '22222222-2222-2222-2222-222222220401', 'Nasser A.', 5, 'Feels like a private majlis. The most relaxing grooming session I''ve had.', now() - interval '7 days'),
('11111111-1111-1111-1111-111111111114', '22222222-2222-2222-2222-222222220402', 'Othman S.', 5, 'Rashed is quiet, focused, and exactly what I want from a barber.', now() - interval '13 days'),
-- Velocity
('11111111-1111-1111-1111-111111111115', '22222222-2222-2222-2222-222222220501', 'Talal F.', 5, 'Nawaf is the skin fade king. Sharpest line work I''ve seen.', now() - interval '1 day'),
('11111111-1111-1111-1111-111111111115', '22222222-2222-2222-2222-222222220502', 'Hassan M.', 4, 'Great French crop. Sami knows textures.', now() - interval '6 days'),
('11111111-1111-1111-1111-111111111115', '22222222-2222-2222-2222-222222220503', 'Mishari T.', 5, 'Fast, clean buzz cut. In and out in 20 minutes.', now() - interval '12 days');
