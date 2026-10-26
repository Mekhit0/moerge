-- moarge currently serves salons in Georgia, so use the Georgian time zone
-- consistently for every salon rather than allowing per-salon time zones.
UPDATE public.salon_settings
SET timezone = 'Asia/Tbilisi'
WHERE timezone IS DISTINCT FROM 'Asia/Tbilisi';
