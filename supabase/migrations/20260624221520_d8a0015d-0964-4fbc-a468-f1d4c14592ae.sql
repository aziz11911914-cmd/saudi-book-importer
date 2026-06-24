
DO $$
DECLARE
  shop1 uuid := gen_random_uuid();
  shop2 uuid := gen_random_uuid();
  shop3 uuid := gen_random_uuid();
  b1 uuid := gen_random_uuid();
  b2 uuid := gen_random_uuid();
  b3 uuid := gen_random_uuid();
  b4 uuid := gen_random_uuid();
  b5 uuid := gen_random_uuid();
  b6 uuid := gen_random_uuid();
  s_fade uuid; s_skin uuid; s_taper uuid; s_french uuid; s_buzz uuid; s_beard uuid;
  svc uuid; bb uuid; ph uuid;
BEGIN
  SELECT id INTO s_fade FROM specialties WHERE slug='fade';
  SELECT id INTO s_skin FROM specialties WHERE slug='skin-fade';
  SELECT id INTO s_taper FROM specialties WHERE slug='taper-fade';
  SELECT id INTO s_french FROM specialties WHERE slug='french-crop';
  SELECT id INTO s_buzz FROM specialties WHERE slug='buzz-cut';
  SELECT id INTO s_beard FROM specialties WHERE slug='beard-styling';

  INSERT INTO shops (id, slug, name_en, name_ar, description_en, description_ar, cover_url, lat, lng, address, city, district, phone, status, featured, rating_avg, rating_count) VALUES
    (shop1, 'royal-cuts-riyadh', 'Royal Cuts', 'رويال كتس', 'Premium grooming lounge in Olaya.', 'صالون رجالي راقي في العليا.', 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=1200', 24.6932, 46.6816, 'King Fahd Rd', 'Riyadh', 'Olaya', '+966500000001', 'active', true, 4.8, 124),
    (shop2, 'noble-barber-riyadh', 'Noble Barber', 'نوبل باربر', 'Modern barbershop with skilled stylists.', 'صالون عصري بحلاقين محترفين.', 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=1200', 24.7741, 46.7388, 'Al Takhassusi', 'Riyadh', 'Al Sahafa', '+966500000002', 'active', true, 4.7, 86),
    (shop3, 'gentlemen-lounge-riyadh', 'Gentlemen Lounge', 'لاونج الجنتلمان', 'Classic shaves and modern cuts.', 'حلاقة كلاسيكية وقصات حديثة.', 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=1200', 24.7136, 46.6753, 'Tahlia St', 'Riyadh', 'Al Olaya', '+966500000003', 'active', true, 4.6, 58);

  -- Hours: Sun-Thu 10:00-22:00 (day_of_week 0..6, Sunday=0)
  INSERT INTO shop_hours (shop_id, day_of_week, opens_at, closes_at)
  SELECT s.id, d, '10:00'::time, '22:00'::time
  FROM (VALUES (shop1),(shop2),(shop3)) AS s(id), generate_series(0,6) d;

  -- Shop photos
  INSERT INTO shop_photos (shop_id, url, sort) VALUES
    (shop1, 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=1200', 0),
    (shop1, 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=1200', 1),
    (shop2, 'https://images.unsplash.com/photo-1593702288056-f173bf3e6b51?w=1200', 0),
    (shop2, 'https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=1200', 1),
    (shop3, 'https://images.unsplash.com/photo-1532710093739-9470acff878f?w=1200', 0);

  -- Barbers
  INSERT INTO barbers (id, shop_id, slug, display_name_en, display_name_ar, title_en, title_ar, bio_en, bio_ar, photo_url, years_experience, status, featured, rating_avg, rating_count, appointments_completed, clients_served) VALUES
    (b1, shop1, 'omar-royal', 'Omar Al-Harbi', 'عمر الحربي', 'Master Barber', 'حلاق محترف', 'Fade specialist with 10 years of experience.', 'متخصص في التدرج بخبرة 10 سنوات.', 'https://images.unsplash.com/photo-1507081323647-4d250478b919?w=600', 10, 'active', true, 4.9, 78, 1200, 400),
    (b2, shop1, 'khaled-royal', 'Khaled Saeed', 'خالد سعيد', 'Senior Stylist', 'مصفف أول', 'Classic cuts and beard sculpting.', 'قصات كلاسيكية وتنسيق لحية.', 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=600', 7, 'active', true, 4.7, 46, 800, 300),
    (b3, shop2, 'faisal-noble', 'Faisal Mansour', 'فيصل منصور', 'Senior Barber', 'حلاق أول', 'Skin fade expert.', 'خبير سكين فيد.', 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=600', 8, 'active', true, 4.8, 52, 900, 350),
    (b4, shop2, 'yousef-noble', 'Yousef Al-Otaibi', 'يوسف العتيبي', 'Barber', 'حلاق', 'Modern crops and textured cuts.', 'قصات عصرية بملمس مميز.', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600', 5, 'active', false, 4.6, 28, 500, 200),
    (b5, shop3, 'majed-gent', 'Majed Al-Qahtani', 'ماجد القحطاني', 'Master Barber', 'حلاق محترف', 'Classic shaves and hot towel treatments.', 'حلاقة كلاسيكية ومناشف ساخنة.', 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=600', 12, 'active', true, 4.9, 64, 1500, 500),
    (b6, shop3, 'sultan-gent', 'Sultan Al-Rashid', 'سلطان الراشد', 'Stylist', 'مصفف', 'Buzz cuts and beard work.', 'بز كت وتنسيق لحية.', 'https://images.unsplash.com/photo-1463453091185-61582044d556?w=600', 4, 'active', false, 4.5, 22, 400, 180);

  -- Barber specialties
  INSERT INTO barber_specialties (barber_id, specialty_id) VALUES
    (b1, s_fade), (b1, s_skin),
    (b2, s_beard), (b2, s_french),
    (b3, s_skin), (b3, s_taper),
    (b4, s_french), (b4, s_buzz),
    (b5, s_beard), (b5, s_fade),
    (b6, s_buzz), (b6, s_beard);

  -- Services per shop, then link to barbers
  FOR svc IN
    SELECT * FROM (VALUES
      (shop1, 'Signature Fade', 'تدرج سيقنتشر', 90, 45, 'haircut'),
      (shop1, 'Beard Sculpt', 'تنسيق لحية', 50, 30, 'beard'),
      (shop2, 'Skin Fade', 'سكين فيد', 100, 45, 'haircut'),
      (shop2, 'Hair & Beard Combo', 'شعر ولحية', 140, 60, 'combo'),
      (shop3, 'Classic Shave', 'حلاقة كلاسيكية', 70, 40, 'shave'),
      (shop3, 'Buzz Cut', 'بز كت', 40, 20, 'haircut')
    ) AS t(sid, name_en, name_ar, price, dur, cat)
  LOOP
  END LOOP;

  INSERT INTO services (id, shop_id, name_en, name_ar, price_sar, duration_min, category, active) VALUES
    (gen_random_uuid(), shop1, 'Signature Fade', 'تدرج سيقنتشر', 90, 45, 'haircut', true),
    (gen_random_uuid(), shop1, 'Beard Sculpt', 'تنسيق لحية', 50, 30, 'beard', true),
    (gen_random_uuid(), shop2, 'Skin Fade', 'سكين فيد', 100, 45, 'haircut', true),
    (gen_random_uuid(), shop2, 'Hair & Beard Combo', 'شعر ولحية', 140, 60, 'combo', true),
    (gen_random_uuid(), shop3, 'Classic Shave', 'حلاقة كلاسيكية', 70, 40, 'shave', true),
    (gen_random_uuid(), shop3, 'Buzz Cut', 'بز كت', 40, 20, 'haircut', true);

  -- Link barbers to all services of their shop
  INSERT INTO barber_services (barber_id, service_id)
  SELECT b.id, s.id FROM barbers b JOIN services s ON s.shop_id = b.shop_id
  WHERE b.id IN (b1,b2,b3,b4,b5,b6);

  -- Availability: Sun-Thu 10-22 for every barber
  INSERT INTO barber_availability (barber_id, day_of_week, starts_at, ends_at)
  SELECT b.id, d, '10:00'::time, '22:00'::time
  FROM barbers b, generate_series(0,6) d
  WHERE b.id IN (b1,b2,b3,b4,b5,b6);

  -- Portfolio photos (5 per barber)
  FOR bb IN SELECT unnest(ARRAY[b1,b2,b3,b4,b5,b6]) LOOP
    INSERT INTO portfolio_photos (barber_id, url, caption_en, caption_ar, sort) VALUES
      (bb, 'https://images.unsplash.com/photo-1599351431613-18ef1fdd27e3?w=900', 'Fresh fade', 'تدرج جديد', 0),
      (bb, 'https://images.unsplash.com/photo-1622286346003-c5c5b370d3bd?w=900', 'Skin fade detail', 'تفاصيل سكين فيد', 1),
      (bb, 'https://images.unsplash.com/photo-1622287162716-f311baa1a2b8?w=900', 'Beard line up', 'تنسيق لحية', 2),
      (bb, 'https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=900', 'Classic cut', 'قصة كلاسيكية', 3),
      (bb, 'https://images.unsplash.com/photo-1635273051939-cd2b1a9b9fa3?w=900', 'Textured crop', 'قصة بملمس', 4);
  END LOOP;

  -- Link some portfolio photos to specialties (just first photo per barber to fade)
  INSERT INTO portfolio_photo_specialties (photo_id, specialty_id)
  SELECT pp.id, s_fade FROM portfolio_photos pp WHERE pp.sort = 0;
  INSERT INTO portfolio_photo_specialties (photo_id, specialty_id)
  SELECT pp.id, s_skin FROM portfolio_photos pp WHERE pp.sort = 1;
  INSERT INTO portfolio_photo_specialties (photo_id, specialty_id)
  SELECT pp.id, s_beard FROM portfolio_photos pp WHERE pp.sort = 2;
  INSERT INTO portfolio_photo_specialties (photo_id, specialty_id)
  SELECT pp.id, s_french FROM portfolio_photos pp WHERE pp.sort = 3;
  INSERT INTO portfolio_photo_specialties (photo_id, specialty_id)
  SELECT pp.id, s_buzz FROM portfolio_photos pp WHERE pp.sort = 4;

  -- Demo reviews
  INSERT INTO demo_reviews (shop_id, barber_id, reviewer_name, rating, comment) VALUES
    (shop1, b1, 'Ahmed', 5, 'Best fade in Riyadh!'),
    (shop1, b1, 'Saad', 5, 'Very professional and clean.'),
    (shop1, b2, 'Mohammed', 4, 'Great beard work.'),
    (shop2, b3, 'Khalid', 5, 'Skin fade was perfect.'),
    (shop2, b4, 'Fahad', 4, 'Nice atmosphere.'),
    (shop3, b5, 'Abdullah', 5, 'Classic shave is a must try.'),
    (shop3, b6, 'Nasser', 4, 'Quick and clean buzz cut.');
END $$;
