
-- Update photo URLs to CDN-hosted assets so they always load
UPDATE public.portfolio_photos SET url = CASE
  WHEN url = '/haircuts/beard-fade.jpg' THEN '/__l5e/assets-v1/c2886aad-9981-47bd-bd37-565da1dbf299/beard-fade.jpg'
  WHEN url = '/haircuts/beard-line-up.jpg' THEN '/__l5e/assets-v1/e6480aab-3a12-426f-8cdb-6db64773ca17/beard-line-up.jpg'
  WHEN url = '/haircuts/beard-shape-up.jpg' THEN '/__l5e/assets-v1/a94dcb88-c6ab-4ce1-bcfe-f165bae31574/beard-shape-up.jpg'
  WHEN url = '/haircuts/buzz-cut-beard.jpg' THEN '/__l5e/assets-v1/c8d5176a-d75d-49fa-b998-f094a5244ebb/buzz-cut-beard.jpg'
  WHEN url = '/haircuts/buzz-cut-fade.jpg' THEN '/__l5e/assets-v1/abfe953d-aeb6-493c-ab36-8e19ff3382c8/buzz-cut-fade.jpg'
  WHEN url = '/haircuts/buzz-cut.jpg' THEN '/__l5e/assets-v1/4e47eef6-e96f-495e-81e1-2b3c4d8f1b91/buzz-cut.jpg'
  WHEN url = '/haircuts/french-crop-skin-fade.jpg' THEN '/__l5e/assets-v1/249b54d0-1ce4-475a-8d41-58d40474802b/french-crop-skin-fade.jpg'
  WHEN url = '/haircuts/french-crop-textured.jpg' THEN '/__l5e/assets-v1/6e993466-2e7c-4ad8-9554-e45224ef3c99/french-crop-textured.jpg'
  WHEN url = '/haircuts/french-crop.jpg' THEN '/__l5e/assets-v1/10530271-a566-497a-ac90-0a87bcfbcdfd/french-crop.jpg'
  WHEN url = '/haircuts/full-beard.jpg' THEN '/__l5e/assets-v1/26265faa-ef21-4e86-bc8f-1a84e361e993/full-beard.jpg'
  WHEN url = '/haircuts/short-beard.jpg' THEN '/__l5e/assets-v1/74104d78-4fb9-4fac-b344-168e3b480f7c/short-beard.jpg'
  WHEN url = '/haircuts/skin-fade-beard.jpg' THEN '/__l5e/assets-v1/ce581559-b334-45c6-99ae-458fd76d8fd4/skin-fade-beard.jpg'
  WHEN url = '/haircuts/skin-fade-high-volume.jpg' THEN '/__l5e/assets-v1/83c00df9-8e73-45e8-863a-93d9463c78b9/skin-fade-high-volume.jpg'
  WHEN url = '/haircuts/skin-fade.jpg' THEN '/__l5e/assets-v1/56f0940e-69ea-4969-ab12-cb00e9e7c0a8/skin-fade.jpg'
  WHEN url = '/haircuts/taper-fade-classic.jpg' THEN '/__l5e/assets-v1/62b66f3d-4e1f-457f-a5a8-e35b060f47af/taper-fade-classic.jpg'
  WHEN url = '/haircuts/taper-fade-natural.jpg' THEN '/__l5e/assets-v1/ab7ace7a-bbbc-4f19-a265-6c70b34f8f14/taper-fade-natural.jpg'
  WHEN url = '/haircuts/taper-fade.jpg' THEN '/__l5e/assets-v1/66e5d7ef-07e1-4129-af79-ca4f697db07c/taper-fade.jpg'
  ELSE url
END;

-- Link each portfolio photo to a bookable service for the one-click booking flow
ALTER TABLE public.portfolio_photos
  ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES public.services(id) ON DELETE SET NULL;

-- Backfill: for each photo, pick the barber's service whose price is closest to the photo's starting price (fallback: cheapest)
UPDATE public.portfolio_photos pp
SET service_id = sub.service_id
FROM (
  SELECT DISTINCT ON (pp.id)
    pp.id AS photo_id,
    bs.service_id
  FROM public.portfolio_photos pp
  JOIN public.barber_services bs ON bs.barber_id = pp.barber_id
  JOIN public.services s ON s.id = bs.service_id
  ORDER BY pp.id, ABS(s.price_sar - COALESCE(pp.starting_price_sar, s.price_sar)) ASC, s.price_sar ASC
) sub
WHERE pp.id = sub.photo_id;
