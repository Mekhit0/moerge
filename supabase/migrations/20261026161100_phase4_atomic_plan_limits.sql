CREATE OR REPLACE FUNCTION public.enforce_staff_plan_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_limit integer; v_status text; v_count integer;
BEGIN
 IF TG_OP='UPDATE' AND NEW.salon_id=OLD.salon_id AND (OLD.is_active OR NOT NEW.is_active) THEN RETURN NEW; END IF;
 SELECT sub.status,pl.staff_limit INTO v_status,v_limit FROM public.subscriptions sub
 JOIN public.plans pl ON pl.salon_id=sub.salon_id AND pl.code=sub.plan_code
 WHERE sub.salon_id=NEW.salon_id FOR UPDATE OF sub;
 IF NOT FOUND THEN RAISE EXCEPTION 'Subscription plan is not configured' USING ERRCODE='23514'; END IF;
 IF v_status='trialing' THEN v_limit:=7; END IF;
 SELECT count(*) INTO v_count FROM public.staff WHERE salon_id=NEW.salon_id AND is_active AND (TG_OP<>'UPDATE' OR id<>OLD.id);
 IF NEW.is_active AND v_count>=v_limit THEN RAISE EXCEPTION 'Staff plan limit reached' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.enforce_staff_plan_limit() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS enforce_staff_plan_limit ON public.staff;
CREATE TRIGGER enforce_staff_plan_limit BEFORE INSERT OR UPDATE OF is_active ON public.staff
FOR EACH ROW EXECUTE FUNCTION public.enforce_staff_plan_limit();

CREATE OR REPLACE FUNCTION public.enforce_branch_plan_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_limit integer; v_count integer;
BEGIN
 IF TG_OP='UPDATE' AND NEW.salon_id=OLD.salon_id AND (OLD.is_active OR NOT NEW.is_active) THEN RETURN NEW; END IF;
 SELECT pl.branch_limit INTO v_limit FROM public.subscriptions sub JOIN public.plans pl
 ON pl.salon_id=sub.salon_id AND pl.code=sub.plan_code WHERE sub.salon_id=NEW.salon_id AND sub.status='active' FOR UPDATE OF sub;
 IF NOT FOUND THEN RAISE EXCEPTION 'An active plan is required to add branches' USING ERRCODE='23514'; END IF;
 SELECT count(*) INTO v_count FROM public.salon_branches WHERE salon_id=NEW.salon_id AND is_active AND (TG_OP<>'UPDATE' OR id<>OLD.id);
 IF NEW.is_active AND v_count>=v_limit THEN RAISE EXCEPTION 'Branch plan limit reached' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.enforce_branch_plan_limit() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS enforce_branch_plan_limit ON public.salon_branches;
CREATE TRIGGER enforce_branch_plan_limit BEFORE INSERT OR UPDATE OF is_active ON public.salon_branches
FOR EACH ROW EXECUTE FUNCTION public.enforce_branch_plan_limit();
