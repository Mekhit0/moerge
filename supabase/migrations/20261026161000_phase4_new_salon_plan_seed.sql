CREATE OR REPLACE FUNCTION public.initialize_salon_billing()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_plan uuid;
BEGIN
 INSERT INTO public.plans(salon_id,code,name_ka,name_en,base_monthly_gel,branch_limit,staff_limit,included_staff,included_sms,extra_staff_monthly_gel)
 VALUES(NEW.id,'business','ბიზნესი','Business',69,1,50,7,500,9),(NEW.id,'multi_branch','მრავალი ფილიალი','Multi-branch',129,999,50,50,1500,9)
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
