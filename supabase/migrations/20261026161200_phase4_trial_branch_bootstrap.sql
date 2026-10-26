CREATE OR REPLACE FUNCTION public.enforce_branch_plan_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_limit integer; v_count integer;
BEGIN
 IF TG_OP='UPDATE' AND NEW.salon_id=OLD.salon_id AND (OLD.is_active OR NOT NEW.is_active) THEN RETURN NEW; END IF;
 SELECT pl.branch_limit INTO v_limit FROM public.subscriptions sub JOIN public.plans pl
 ON pl.salon_id=sub.salon_id AND pl.code=sub.plan_code WHERE sub.salon_id=NEW.salon_id FOR UPDATE OF sub;
 IF NOT FOUND THEN RAISE EXCEPTION 'Subscription plan is not configured' USING ERRCODE='23514'; END IF;
 SELECT count(*) INTO v_count FROM public.salon_branches WHERE salon_id=NEW.salon_id AND is_active AND (TG_OP<>'UPDATE' OR id<>OLD.id);
 IF NEW.is_active AND v_count>=v_limit THEN RAISE EXCEPTION 'Branch plan limit reached' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.enforce_branch_plan_limit() FROM PUBLIC,anon,authenticated,service_role;
