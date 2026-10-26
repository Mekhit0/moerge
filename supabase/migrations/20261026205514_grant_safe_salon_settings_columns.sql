-- Keep the authenticated read grant aligned with SAFE_SALON_SETTINGS_SELECT.
-- Row access remains restricted by the existing salon membership RLS policy.
GRANT SELECT (
  booking_cancel_deadline_hours,
  onboarding_completed_at,
  deposit_required,
  deposit_amount_gel,
  deposit_percentage
) ON public.salon_settings TO authenticated;