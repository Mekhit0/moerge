-- Fix: new salons could not be created.
-- initialize_salon_billing adds a "Main branch" for every new (trialing) salon, but
-- 20261029130000_multi_branch_addon_pricing.sql made enforce_branch_plan_limit require an active
-- subscription for any branch, which re-broke the trial bootstrap fixed in
-- 20261026161200_phase4_trial_branch_bootstrap.sql. Sign-up failed with
-- "An active plan is required to add branches".
-- Now every salon may have its first branch; additional branches still need an active plan.

CREATE OR REPLACE FUNCTION public.enforce_branch_plan_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_limit integer; v_plan_code text; v_status text; v_count integer;
BEGIN
 IF TG_OP='UPDATE' AND NEW.salon_id=OLD.salon_id AND (OLD.is_active OR NOT NEW.is_active) THEN RETURN NEW; END IF;
 SELECT pl.branch_limit,sub.plan_code,sub.status INTO v_limit,v_plan_code,v_status FROM public.subscriptions sub
 JOIN public.plans pl ON pl.salon_id=sub.salon_id AND pl.code=sub.plan_code
 WHERE sub.salon_id=NEW.salon_id FOR UPDATE OF sub;
 IF NOT FOUND THEN RAISE EXCEPTION 'Subscription plan is not configured' USING ERRCODE='23514'; END IF;
 SELECT count(*) INTO v_count FROM public.salon_branches
 WHERE salon_id=NEW.salon_id AND is_active AND (TG_OP<>'UPDATE' OR id<>OLD.id);
 IF NOT NEW.is_active THEN RETURN NEW; END IF;
 IF v_status<>'active' THEN
  IF v_count>=1 THEN RAISE EXCEPTION 'An active plan is required to add branches' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 IF v_count>=v_limit AND v_plan_code<>'multi_branch' THEN
  RAISE EXCEPTION 'Branch plan limit reached' USING ERRCODE='23514';
 END IF;
 IF v_count>=999 THEN RAISE EXCEPTION 'Maximum branch count reached' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.enforce_branch_plan_limit() FROM PUBLIC,anon,authenticated,service_role;
