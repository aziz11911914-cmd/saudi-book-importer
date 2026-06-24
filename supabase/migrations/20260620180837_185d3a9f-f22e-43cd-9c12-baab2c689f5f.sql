UPDATE public.portfolio_photos SET url = CASE
  WHEN caption_en ILIKE '%buzz%' THEN
    (ARRAY[
      'https://images.unsplash.com/photo-1504257432389-52343af06ae3?w=1200&q=80',
      'https://images.unsplash.com/photo-1593163019108-0f2c4f00e21c?w=1200&q=80',
      'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=1200&q=80'
    ])[1 + (abs(hashtext(id::text)) % 3)]
  WHEN caption_en ILIKE '%beard%' OR caption_en ILIKE '%shave%' OR caption_en ILIKE '%towel%' OR caption_en ILIKE '%oud%' THEN
    (ARRAY[
      'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=1200&q=80',
      'https://images.unsplash.com/photo-1559599101-f09722fb4948?w=1200&q=80',
      'https://images.unsplash.com/photo-1559548331-f9cb98001426?w=1200&q=80',
      'https://images.unsplash.com/photo-1542327897-d73f4005b533?w=1200&q=80'
    ])[1 + (abs(hashtext(id::text)) % 4)]
  WHEN caption_en ILIKE '%french%' OR caption_en ILIKE '%crop%' OR caption_en ILIKE '%fringe%' THEN
    (ARRAY[
      'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=1200&q=80',
      'https://images.unsplash.com/photo-1517163715405-de4fcbbe21d2?w=1200&q=80',
      'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=1200&q=80'
    ])[1 + (abs(hashtext(id::text)) % 3)]
  WHEN caption_en ILIKE '%skin fade%' THEN
    (ARRAY[
      'https://images.unsplash.com/photo-1622287162716-f311baa1a2b8?w=1200&q=80',
      'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=1200&q=80',
      'https://images.unsplash.com/photo-1567894340315-735d7c361db0?w=1200&q=80',
      'https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=1200&q=80'
    ])[1 + (abs(hashtext(id::text)) % 4)]
  WHEN caption_en ILIKE '%taper%' OR caption_en ILIKE '%fade%' OR caption_en ILIKE '%cut%' THEN
    (ARRAY[
      'https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=1200&q=80',
      'https://images.unsplash.com/photo-1582015752624-e8b1c75e3711?w=1200&q=80',
      'https://images.unsplash.com/photo-1521119989659-a83eee488004?w=1200&q=80',
      'https://images.unsplash.com/photo-1622287162716-f311baa1a2b8?w=1200&q=80',
      'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=1200&q=80'
    ])[1 + (abs(hashtext(id::text)) % 5)]
  WHEN caption_en ILIKE '%line%' THEN
    (ARRAY[
      'https://images.unsplash.com/photo-1593163019108-0f2c4f00e21c?w=1200&q=80',
      'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=1200&q=80'
    ])[1 + (abs(hashtext(id::text)) % 2)]
  ELSE
    (ARRAY[
      'https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=1200&q=80',
      'https://images.unsplash.com/photo-1622287162716-f311baa1a2b8?w=1200&q=80',
      'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=1200&q=80',
      'https://images.unsplash.com/photo-1582015752624-e8b1c75e3711?w=1200&q=80'
    ])[1 + (abs(hashtext(id::text)) % 4)]
END;