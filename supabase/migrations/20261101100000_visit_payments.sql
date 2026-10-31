-- Visit payments: what a client actually paid for a visit (cash, card or both), with discount and tip.
-- Rows are written only through record_visit_payment / void_visit_payment so the money rules live in
-- the database: amounts are never negative, cash + card always equals total + tip, one active
-- payment per visit, and only owners or admins can undo a payment.

CREATE TABLE public.visit_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  price_gel numeric(10,2) NOT NULL CHECK (price_gel >= 0),
  discount_gel numeric(10,2) NOT NULL DEFAULT 0 CHECK (discount_gel >= 0 AND discount_gel <= price_gel),
  total_gel numeric(10,2) GENERATED ALWAYS AS (price_gel - discount_gel) STORED,
  tip_gel numeric(10,2) NOT NULL DEFAULT 0 CHECK (tip_gel >= 0),
  cash_gel numeric(10,2) NOT NULL DEFAULT 0 CHECK (cash_gel >= 0),
  card_gel numeric(10,2) NOT NULL DEFAULT 0 CHECK (card_gel >= 0),
  taken_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  voided_at timestamptz,
  voided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  void_reason text CHECK (void_reason IS NULL OR length(trim(void_reason)) BETWEEN 2 AND 300),
  CONSTRAINT visit_payments_split_matches_total CHECK (cash_gel + card_gel = price_gel - discount_gel + tip_gel),
  CONSTRAINT visit_payments_void_complete CHECK ((voided_at IS NULL) = (void_reason IS NULL))
);

CREATE UNIQUE INDEX visit_payments_one_active_per_visit ON public.visit_payments(appointment_id) WHERE voided_at IS NULL;
CREATE INDEX visit_payments_salon_created_idx ON public.visit_payments(salon_id, created_at DESC);
CREATE INDEX visit_payments_staff_created_idx ON public.visit_payments(salon_id, staff_id, created_at DESC);
CREATE INDEX visit_payments_client_idx ON public.visit_payments(client_id);
CREATE INDEX visit_payments_taken_by_idx ON public.visit_payments(taken_by);
CREATE INDEX visit_payments_voided_by_idx ON public.visit_payments(voided_by);

ALTER TABLE public.visit_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY visit_payments_member_read ON public.visit_payments
  FOR SELECT TO authenticated USING (public.user_has_salon_access(salon_id));
-- No insert, update or delete policies: members change payments only through the functions below.
REVOKE ALL ON public.visit_payments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.visit_payments TO authenticated;
GRANT ALL ON public.visit_payments TO service_role;

-- Audit: payments join the salon audit trail (field names only, never amounts).
ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS audit_log_entity_type_check;
ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_entity_type_check
  CHECK (entity_type IN ('salon_settings','salons','staff','staff_services','appointments','visit_payments'));
DROP TRIGGER IF EXISTS audit_visit_payment_changes ON public.visit_payments;
CREATE TRIGGER audit_visit_payment_changes AFTER INSERT OR UPDATE OR DELETE ON public.visit_payments
FOR EACH ROW EXECUTE FUNCTION public.capture_salon_audit();

-- Record a payment for a visit that is marked done. The price comes from the visit unless the
-- salon enters a different one (extra work); everything else is validated here.
CREATE OR REPLACE FUNCTION public.record_visit_payment(
  p_appointment_id uuid,
  p_price_gel numeric,
  p_discount_gel numeric,
  p_tip_gel numeric,
  p_cash_gel numeric,
  p_card_gel numeric
)
RETURNS public.visit_payments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_appointment public.appointments%ROWTYPE;
  v_price numeric(10,2);
  v_discount numeric(10,2) := round(coalesce(p_discount_gel, 0), 2);
  v_tip numeric(10,2) := round(coalesce(p_tip_gel, 0), 2);
  v_cash numeric(10,2) := round(coalesce(p_cash_gel, 0), 2);
  v_card numeric(10,2) := round(coalesce(p_card_gel, 0), 2);
  v_row public.visit_payments%ROWTYPE;
BEGIN
  SELECT * INTO v_appointment FROM public.appointments WHERE id = p_appointment_id FOR UPDATE;
  IF NOT FOUND OR NOT public.user_has_salon_access(v_appointment.salon_id) THEN
    RAISE EXCEPTION 'Visit not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_appointment.status <> 'completed' THEN
    RAISE EXCEPTION 'Mark the visit as done before taking payment' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public.visit_payments WHERE appointment_id = v_appointment.id AND voided_at IS NULL) THEN
    RAISE EXCEPTION 'This visit is already paid' USING ERRCODE = '23505';
  END IF;

  v_price := round(coalesce(p_price_gel, v_appointment.price_snapshot, v_appointment.price_gel, 0), 2);
  IF v_price < 0 OR v_price > 100000 OR v_discount < 0 OR v_discount > v_price OR v_tip < 0 OR v_tip > 100000 OR v_cash < 0 OR v_card < 0 THEN
    RAISE EXCEPTION 'Payment amounts are not valid' USING ERRCODE = '22023';
  END IF;
  IF v_cash + v_card <> v_price - v_discount + v_tip THEN
    RAISE EXCEPTION 'Cash and card must add up to the total' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.visit_payments (salon_id, appointment_id, client_id, staff_id, price_gel, discount_gel, tip_gel, cash_gel, card_gel, taken_by)
  VALUES (v_appointment.salon_id, v_appointment.id, v_appointment.client_id, v_appointment.staff_id, v_price, v_discount, v_tip, v_cash, v_card, auth.uid())
  RETURNING * INTO v_row;
  RETURN v_row;
END; $$;
REVOKE EXECUTE ON FUNCTION public.record_visit_payment(uuid, numeric, numeric, numeric, numeric, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_visit_payment(uuid, numeric, numeric, numeric, numeric, numeric) TO authenticated;

-- Undo a payment (wrong amount, wrong visit). Owners and admins only; the row is kept with a reason.
CREATE OR REPLACE FUNCTION public.void_visit_payment(p_payment_id uuid, p_reason text)
RETURNS public.visit_payments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_row public.visit_payments%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.visit_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND OR NOT public.user_has_salon_access(v_row.salon_id) THEN
    RAISE EXCEPTION 'Payment not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.user_is_salon_admin(v_row.salon_id) THEN
    RAISE EXCEPTION 'Only the owner or an admin can undo a payment' USING ERRCODE = '42501';
  END IF;
  IF v_row.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'This payment is already undone' USING ERRCODE = '23514';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 2 THEN
    RAISE EXCEPTION 'Enter a reason' USING ERRCODE = '22023';
  END IF;
  UPDATE public.visit_payments
  SET voided_at = now(), voided_by = auth.uid(), void_reason = left(trim(p_reason), 300)
  WHERE id = p_payment_id
  RETURNING * INTO v_row;
  RETURN v_row;
END; $$;
REVOKE EXECUTE ON FUNCTION public.void_visit_payment(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.void_visit_payment(uuid, text) TO authenticated;
