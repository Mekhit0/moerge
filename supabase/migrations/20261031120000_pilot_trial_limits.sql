-- Pilot month: new salons get a 30-day free trial and trial salons may have up to 10 active staff.
-- Keep in sync with BILLING_CONFIG.trialDays and BILLING_CONFIG.trialStaffLimit in src/lib/billing-plans.ts.

-- ensure_user_salon inserts trialing salons with a 14-day trial_ends_at. Raise it to 30 days before
-- the row is stored, so the AFTER INSERT initialize_salon_billing trigger copies the longer trial
-- into public.subscriptions as well.
CREATE OR REPLACE FUNCTION public.set_pilot_trial_length()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW.subscription_status = 'trialing' THEN
  NEW.trial_ends_at := GREATEST(COALESCE(NEW.trial_ends_at, now()), now() + interval '30 days');
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.set_pilot_trial_length() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS set_pilot_trial_length ON public.salons;
CREATE TRIGGER set_pilot_trial_length BEFORE INSERT ON public.salons
FOR EACH ROW EXECUTE FUNCTION public.set_pilot_trial_length();

-- Salons already on a trial get the full pilot month from today.
UPDATE public.salons
SET trial_ends_at = now() + interval '30 days'
WHERE subscription_status = 'trialing'
  AND (trial_ends_at IS NULL OR trial_ends_at < now() + interval '30 days');

UPDATE public.subscriptions
SET trial_ends_at = now() + interval '30 days', updated_at = now()
WHERE status = 'trialing'
  AND trial_ends_at < now() + interval '30 days';

-- Trial staff cap: 7 -> 10. Same function as 20261026161100_phase4_atomic_plan_limits.sql otherwise.
CREATE OR REPLACE FUNCTION public.enforce_staff_plan_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_limit integer; v_status text; v_count integer;
BEGIN
 IF TG_OP='UPDATE' AND NEW.salon_id=OLD.salon_id AND (OLD.is_active OR NOT NEW.is_active) THEN RETURN NEW; END IF;
 SELECT sub.status,pl.staff_limit INTO v_status,v_limit FROM public.subscriptions sub
 JOIN public.plans pl ON pl.salon_id=sub.salon_id AND pl.code=sub.plan_code
 WHERE sub.salon_id=NEW.salon_id FOR UPDATE OF sub;
 IF NOT FOUND THEN RAISE EXCEPTION 'Subscription plan is not configured' USING ERRCODE='23514'; END IF;
 IF v_status='trialing' THEN v_limit:=10; END IF;
 SELECT count(*) INTO v_count FROM public.staff WHERE salon_id=NEW.salon_id AND is_active AND (TG_OP<>'UPDATE' OR id<>OLD.id);
 IF NEW.is_active AND v_count>=v_limit THEN RAISE EXCEPTION 'Staff plan limit reached' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.enforce_staff_plan_limit() FROM PUBLIC,anon,authenticated,service_role;
