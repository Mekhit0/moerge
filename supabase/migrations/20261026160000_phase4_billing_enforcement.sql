-- Keep the ledger provisioned for salons created after this migration.
CREATE OR REPLACE FUNCTION public.initialize_salon_billing()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_plan uuid;
BEGIN
 INSERT INTO public.plans(salon_id,code,name_ka,name_en,base_monthly_gel,branch_limit,staff_limit,included_sms,extra_staff_monthly_gel)
 VALUES(NEW.id,'business','ბიზნესი','Business',69,1,7,500,9),(NEW.id,'multi_branch','მრავალი ფილიალი','Multi-branch',129,999,50,1500,9)
 ON CONFLICT(salon_id,code) DO NOTHING;
 SELECT id INTO v_plan FROM public.plans WHERE salon_id=NEW.id AND code='business';
 INSERT INTO public.subscriptions(salon_id,plan_id,plan_code,status,trial_ends_at)
 VALUES(NEW.id,v_plan,'business','trialing',COALESCE(NEW.trial_ends_at,now()+interval '14 days'))
 ON CONFLICT(salon_id) DO NOTHING;
 INSERT INTO public.sms_wallet(salon_id,included_quota) VALUES(NEW.id,0) ON CONFLICT(salon_id) DO NOTHING;
 INSERT INTO public.salon_branches(salon_id,name) VALUES(NEW.id,'Main branch') ON CONFLICT(salon_id,name) DO NOTHING;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.initialize_salon_billing() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS initialize_salon_billing ON public.salons;
CREATE TRIGGER initialize_salon_billing AFTER INSERT ON public.salons FOR EACH ROW EXECUTE FUNCTION public.initialize_salon_billing();

CREATE OR REPLACE FUNCTION public.enforce_paid_subscription_for_appointments()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_status text; v_trial_end timestamptz; v_grace_end timestamptz;
BEGIN
 SELECT status,trial_ends_at,grace_ends_at INTO v_status,v_trial_end,v_grace_end FROM public.subscriptions WHERE salon_id=NEW.salon_id;
 IF v_status='active' OR (v_status='trialing' AND v_trial_end>now()) OR (v_status='past_due' AND v_grace_end>now()) THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'Salon subscription is read-only' USING ERRCODE='42501';
END; $$;
REVOKE ALL ON FUNCTION public.enforce_paid_subscription_for_appointments() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS enforce_paid_subscription_for_appointments ON public.appointments;
CREATE TRIGGER enforce_paid_subscription_for_appointments BEFORE INSERT OR UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.enforce_paid_subscription_for_appointments();

