-- Public availability data is served through authenticated server routes using service_role.
-- Do not allow callers to bypass those routes and invoke the SECURITY DEFINER RPCs directly.
REVOKE EXECUTE ON FUNCTION public.get_available_slots(uuid,uuid,date,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_available_slots(uuid,uuid,date,uuid,uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_public_salon_booking_info(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_salon_booking_info(text) TO service_role;

-- Keep trigger execution schema-stable; trigger functions still run with their owner privileges.
ALTER FUNCTION public.salon_set_updated_at() SET search_path = pg_catalog, public;

-- Cover hot FK lookups and the new RLS-scoped audit/feedback queries.
CREATE INDEX IF NOT EXISTS appointments_resource_fk_idx ON public.appointments(resource_id);
CREATE INDEX IF NOT EXISTS appointments_created_by_idx ON public.appointments(created_by);
CREATE INDEX IF NOT EXISTS audit_log_actor_idx ON public.audit_log(actor_id);
CREATE INDEX IF NOT EXISTS dashboard_feedback_salon_idx ON public.dashboard_feedback(salon_id);
CREATE INDEX IF NOT EXISTS dashboard_feedback_submitter_idx ON public.dashboard_feedback(submitted_by);
CREATE INDEX IF NOT EXISTS notification_log_appointment_idx ON public.notification_log(appointment_id);
CREATE INDEX IF NOT EXISTS notification_log_client_idx ON public.notification_log(client_id);

DROP POLICY IF EXISTS dashboard_feedback_member_insert ON public.dashboard_feedback;
CREATE POLICY dashboard_feedback_member_insert ON public.dashboard_feedback FOR INSERT TO authenticated
  WITH CHECK (public.user_has_salon_access(salon_id) AND submitted_by=(SELECT auth.uid()));
