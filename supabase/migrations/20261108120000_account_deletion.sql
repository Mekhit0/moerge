-- Deleting a salon, and deleting one's own login.
--
-- delete_salon(): the salon owner deletes the salon and everything in it (clients, visits, staff,
-- settings, SMS log...). Invoices and payments are copied to billing_archive first, without any
-- client data, because tax law requires keeping them. Returns the logins that belonged only to this
-- salon, so the app can delete those accounts too.
--
-- While a salon is being deleted, the read-only rule (expired trials) and the audit trail skip its
-- rows, so an expired salon can still be deleted and the audit trail does not point at a salon that
-- is gone. Both checks use a setting that lives only inside the deleting transaction.

CREATE TABLE IF NOT EXISTS public.billing_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL,
  salon_name text NOT NULL,
  invoices jsonb NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.billing_archive ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.billing_archive FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.billing_archive TO service_role;

CREATE OR REPLACE FUNCTION public.salon_being_deleted(p_salon uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path = pg_catalog, public AS $$
  SELECT p_salon IS NOT NULL AND current_setting('moarge.deleting_salon', true) = p_salon::text
$$;
REVOKE ALL ON FUNCTION public.salon_being_deleted(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.enforce_salon_subscription_writable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_salon uuid; v_status text; v_trial_end timestamptz; v_grace_end timestamptz;
BEGIN
 v_salon:=CASE WHEN TG_OP='DELETE' THEN OLD.salon_id ELSE NEW.salon_id END;
 IF TG_OP='DELETE' AND public.salon_being_deleted(v_salon) THEN RETURN OLD; END IF;
 SELECT status,trial_ends_at,grace_ends_at INTO v_status,v_trial_end,v_grace_end FROM public.subscriptions WHERE salon_id=v_salon;
 IF v_status='active' OR (v_status='trialing' AND v_trial_end>now()) OR (v_status='past_due' AND v_grace_end>now()) THEN
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
 END IF;
 RAISE EXCEPTION 'Salon subscription is read-only' USING ERRCODE='42501';
END; $$;
REVOKE ALL ON FUNCTION public.enforce_salon_subscription_writable() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.capture_salon_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, auth AS $$
DECLARE
  v_old jsonb; v_new jsonb; v_salon uuid; v_entity uuid; v_fields text[];
BEGIN
  IF TG_OP <> 'INSERT' THEN v_old:=to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN v_new:=to_jsonb(NEW); END IF;
  v_salon:=COALESCE((v_new->>'salon_id')::uuid,(v_old->>'salon_id')::uuid);
  IF TG_TABLE_NAME='salons' THEN v_salon:=COALESCE((v_new->>'id')::uuid,(v_old->>'id')::uuid); END IF;
  IF TG_OP='DELETE' AND public.salon_being_deleted(v_salon) THEN RETURN OLD; END IF;
  v_entity:=COALESCE((v_new->>'id')::uuid,(v_old->>'id')::uuid);
  IF TG_TABLE_NAME='staff_services' THEN
    v_entity:=COALESCE((v_new->>'staff_id')::uuid,(v_old->>'staff_id')::uuid);
  END IF;
  IF TG_OP='INSERT' THEN
    SELECT COALESCE(array_agg(key ORDER BY key),'{}') INTO v_fields FROM jsonb_object_keys(v_new) AS keys(key)
      WHERE key NOT IN ('id','salon_id','created_at','updated_at');
  ELSIF TG_OP='DELETE' THEN
    SELECT COALESCE(array_agg(key ORDER BY key),'{}') INTO v_fields FROM jsonb_object_keys(v_old) AS keys(key)
      WHERE key NOT IN ('id','salon_id','created_at','updated_at');
  ELSE
    SELECT COALESCE(array_agg(n.key ORDER BY n.key),'{}') INTO v_fields
    FROM jsonb_each(v_new) n JOIN jsonb_each(v_old) o USING(key)
    WHERE n.value IS DISTINCT FROM o.value AND n.key NOT IN ('id','salon_id','created_at','updated_at');
    IF TG_TABLE_NAME='salons' THEN v_fields:=ARRAY(SELECT x FROM unnest(v_fields) x WHERE x IN ('name','slug')); END IF;
  END IF;
  IF cardinality(v_fields)>0 THEN
    INSERT INTO public.audit_log(salon_id,actor_id,action,entity_type,entity_id,changed_fields)
    VALUES(v_salon,auth.uid(),lower(TG_OP),TG_TABLE_NAME,v_entity,v_fields);
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.capture_salon_audit() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.delete_salon(p_salon_id uuid, p_actor uuid)
RETURNS uuid[] LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_name text; v_members uuid[]; v_orphans uuid[];
BEGIN
 IF public.request_role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service role only' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.salon_memberships WHERE salon_id=p_salon_id AND user_id=p_actor AND role='owner' AND is_active) THEN
  RAISE EXCEPTION 'Only the salon owner can delete the salon' USING ERRCODE='42501';
 END IF;
 SELECT name INTO v_name FROM public.salons WHERE id=p_salon_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Salon not found' USING ERRCODE='P0002'; END IF;

 INSERT INTO public.billing_archive(salon_id,salon_name,invoices)
 SELECT p_salon_id, v_name, jsonb_agg(jsonb_build_object(
   'invoice', to_jsonb(i),
   'lines', (SELECT COALESCE(jsonb_agg(to_jsonb(l)),'[]') FROM public.invoice_lines l WHERE l.invoice_id=i.id),
   'payments', (SELECT COALESCE(jsonb_agg(to_jsonb(p)),'[]') FROM public.payments p WHERE p.invoice_id=i.id)))
 FROM public.invoices i WHERE i.salon_id=p_salon_id
 HAVING count(*)>0;

 SELECT COALESCE(array_agg(DISTINCT user_id),'{}') INTO v_members FROM public.salon_memberships WHERE salon_id=p_salon_id;
 PERFORM set_config('moarge.deleting_salon', p_salon_id::text, true);
 DELETE FROM public.salons WHERE id=p_salon_id;
 PERFORM set_config('moarge.deleting_salon', '', true);

 SELECT COALESCE(array_agg(m),'{}') INTO v_orphans FROM unnest(v_members) m
 WHERE NOT EXISTS (SELECT 1 FROM public.salon_memberships sm WHERE sm.user_id=m);
 RETURN v_orphans;
END; $$;
REVOKE ALL ON FUNCTION public.delete_salon(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_salon(uuid,uuid) TO service_role;
