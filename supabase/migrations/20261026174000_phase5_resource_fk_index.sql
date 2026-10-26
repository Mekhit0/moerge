-- The resource FK includes salon_id, so use a matching composite index for cascade checks.
CREATE INDEX IF NOT EXISTS appointments_salon_resource_fk_idx
  ON public.appointments(salon_id,resource_id);
