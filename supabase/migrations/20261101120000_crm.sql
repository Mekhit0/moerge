-- Dashboard step 6: CRM.
-- 1. Client card fields: birthday and preferred master. The existing clients.notes is the pinned note.
-- 2. client_notes: dated notes that matter in a salon (allergies, color formulas, anything else).
--    Anyone who can see the client can read and add notes; the author or the office can delete them.
-- 3. client_stats: numbers per client, computed under the caller's own access, so a master only
--    counts their own visits.
-- 4. merge_clients: join a duplicate client into another one, moving every visit and message.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS birthday date CHECK (birthday IS NULL OR birthday BETWEEN DATE '1900-01-01' AND DATE '2100-01-01'),
  ADD COLUMN IF NOT EXISTS preferred_staff_id uuid;
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_preferred_staff_fk;
ALTER TABLE public.clients ADD CONSTRAINT clients_preferred_staff_fk
  FOREIGN KEY (salon_id, preferred_staff_id) REFERENCES public.staff(salon_id, id) ON DELETE SET NULL (preferred_staff_id);
CREATE INDEX IF NOT EXISTS clients_preferred_staff_idx ON public.clients (salon_id, preferred_staff_id) WHERE preferred_staff_id IS NOT NULL;

CREATE TABLE public.client_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'note' CHECK (kind IN ('note', 'allergy', 'formula')),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
  created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX client_notes_client_idx ON public.client_notes (client_id, created_at DESC);
CREATE INDEX client_notes_salon_idx ON public.client_notes (salon_id);
CREATE INDEX client_notes_created_by_idx ON public.client_notes (created_by);

ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;
-- The subquery on clients runs under the caller's own client access (masters: their clients only).
CREATE POLICY client_notes_read ON public.client_notes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_notes.client_id AND c.salon_id = client_notes.salon_id));
CREATE POLICY client_notes_insert ON public.client_notes FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.user_has_salon_access(salon_id)
    AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_notes.client_id AND c.salon_id = client_notes.salon_id)
  );
CREATE POLICY client_notes_delete ON public.client_notes FOR DELETE TO authenticated
  USING (public.user_is_salon_admin(salon_id) OR (created_by = auth.uid() AND public.user_has_salon_access(salon_id)));
REVOKE ALL ON public.client_notes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.client_notes TO authenticated;
GRANT ALL ON public.client_notes TO service_role;

ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS audit_log_entity_type_check;
ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_entity_type_check
  CHECK (entity_type IN ('salon_settings','salons','staff','staff_services','appointments','visit_payments','client_notes'));
DROP TRIGGER IF EXISTS audit_client_notes ON public.client_notes;
CREATE TRIGGER audit_client_notes AFTER INSERT OR DELETE ON public.client_notes
  FOR EACH ROW EXECUTE FUNCTION public.capture_salon_audit();

-- Visits counted as done: completed. Spent: the paid total after discount (tips belong to the master),
-- or the booked price when the salon did not record a payment.
CREATE OR REPLACE VIEW public.client_stats WITH (security_invoker = true) AS
SELECT
  c.id AS client_id,
  c.salon_id,
  coalesce(v.visit_count, 0)::int AS visit_count,
  coalesce(v.no_show_count, 0)::int AS no_show_count,
  coalesce(v.total_spent, 0)::numeric(12,2) AS total_spent,
  v.first_visit,
  v.last_visit,
  v.next_visit,
  CASE WHEN v.visit_count >= 2 THEN round((v.last_visit - v.first_visit)::numeric / (v.visit_count - 1))::int END AS avg_gap_days,
  c.next_expected_appointment_date AS next_expected_date,
  c.birthday
FROM public.clients c
LEFT JOIN LATERAL (
  SELECT
    count(*) FILTER (WHERE a.status = 'completed') AS visit_count,
    count(*) FILTER (WHERE a.status IN ('no_show', 'missed')) AS no_show_count,
    sum(coalesce(p.total_gel, a.price_snapshot, a.price_gel, 0)) FILTER (WHERE a.status = 'completed') AS total_spent,
    min(a.treatment_date) FILTER (WHERE a.status = 'completed') AS first_visit,
    max(a.treatment_date) FILTER (WHERE a.status = 'completed') AS last_visit,
    min(a.treatment_date) FILTER (
      WHERE a.status IN ('scheduled', 'arrived') AND a.treatment_date >= (now() AT TIME ZONE 'Asia/Tbilisi')::date
    ) AS next_visit
  FROM public.appointments a
  LEFT JOIN LATERAL (
    SELECT vp.total_gel FROM public.visit_payments vp
    WHERE vp.appointment_id = a.id AND vp.voided_at IS NULL
    LIMIT 1
  ) p ON true
  WHERE a.client_id = c.id AND a.salon_id = c.salon_id
) v ON true;

REVOKE ALL ON public.client_stats FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.client_stats TO authenticated, service_role;

-- Join p_merge into p_keep. Visits, payments, reminders, messages and notes move to p_keep; empty
-- fields on p_keep are filled from p_merge; tags are combined; then p_merge is deleted. Office only.
CREATE OR REPLACE FUNCTION public.merge_clients(p_keep uuid, p_merge uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_keep public.clients%ROWTYPE;
  v_merge public.clients%ROWTYPE;
BEGIN
  IF p_keep IS NULL OR p_merge IS NULL OR p_keep = p_merge THEN
    RAISE EXCEPTION 'Choose two different clients' USING ERRCODE = '22023';
  END IF;
  -- Lock in a fixed order so two merges of the same pair cannot deadlock.
  PERFORM 1 FROM public.clients WHERE id IN (p_keep, p_merge) ORDER BY id FOR UPDATE;
  SELECT * INTO v_keep FROM public.clients WHERE id = p_keep;
  SELECT * INTO v_merge FROM public.clients WHERE id = p_merge;
  IF v_keep.id IS NULL OR v_merge.id IS NULL OR v_keep.salon_id <> v_merge.salon_id
     OR NOT public.user_is_salon_admin(v_keep.salon_id) THEN
    RAISE EXCEPTION 'Client not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.appointments SET client_id = p_keep WHERE client_id = p_merge AND salon_id = v_keep.salon_id;
  UPDATE public.visit_payments SET client_id = p_keep WHERE client_id = p_merge AND salon_id = v_keep.salon_id;
  UPDATE public.reminders SET client_id = p_keep WHERE client_id = p_merge AND salon_id = v_keep.salon_id;
  UPDATE public.email_logs SET client_id = p_keep WHERE client_id = p_merge AND salon_id = v_keep.salon_id;
  UPDATE public.notification_log SET client_id = p_keep WHERE client_id = p_merge AND salon_id = v_keep.salon_id;
  UPDATE public.client_notes SET client_id = p_keep WHERE client_id = p_merge AND salon_id = v_keep.salon_id;

  -- The duplicate goes first so its email is free for the kept client.
  DELETE FROM public.clients WHERE id = p_merge;

  UPDATE public.clients SET
    email = coalesce(v_keep.email, v_merge.email),
    notes = CASE
      WHEN v_keep.notes IS NULL THEN v_merge.notes
      WHEN v_merge.notes IS NULL OR v_merge.notes = v_keep.notes THEN v_keep.notes
      ELSE left(v_keep.notes || E'\n' || v_merge.notes, 1000)
    END,
    tags = ARRAY(SELECT DISTINCT t FROM unnest(v_keep.tags || v_merge.tags) AS t ORDER BY t),
    birthday = coalesce(v_keep.birthday, v_merge.birthday),
    preferred_staff_id = coalesce(v_keep.preferred_staff_id, v_merge.preferred_staff_id),
    last_completed_epilation_date = greatest(v_keep.last_completed_epilation_date, v_merge.last_completed_epilation_date),
    next_expected_appointment_date = greatest(v_keep.next_expected_appointment_date, v_merge.next_expected_appointment_date),
    is_blocked = v_keep.is_blocked OR v_merge.is_blocked
  WHERE id = p_keep;
  RETURN p_keep;
END; $$;
REVOKE EXECUTE ON FUNCTION public.merge_clients(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_clients(uuid, uuid) TO authenticated;
