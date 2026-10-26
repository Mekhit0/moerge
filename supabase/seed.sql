-- LOCAL DEVELOPMENT ONLY. Never run this seed in production.
-- Contains synthetic salon and client records. No auth users or credentials are created.
DO $$
DECLARE
  v_salon_id uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_client_id uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
BEGIN
  INSERT INTO public.salons (id, name, slug, subscription_tier, subscription_status, trial_ends_at)
  VALUES (v_salon_id, 'moarge Demo Salon', 'moarge-demo', 'starter', 'trialing', now() + interval '14 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.salon_settings (
    salon_id, salon_name, sender_display_name, verified_sender_email,
    timezone, reminder_interval_days, email_subject, email_body_template,
    booking_url, brand_color, auto_reminders_enabled, dry_run_mode,
    test_recipient_email, custom_services
  ) VALUES (
    v_salon_id,
    'moarge Demo Salon',
    'moarge Demo Salon',
    'demo@example.com',
    'Asia/Tbilisi',
    21,
    'თქვენი შემდეგი ვიზიტის დროა',
    'გამარჯობა {{client_name}}, დაჯავშნეთ შემდეგი ვიზიტი: {{booking_link}}',
    'https://example.com/book?salon=moarge-demo',
    '#e11d48',
    false,
    true,
    'demo@example.com',
    '[{"id":"demo-service","type":"facial","name_ka":"საჩვენებელი მომსახურება","name_en":"Demo service","price_gel":0,"duration_minutes":45,"is_epilation":false,"enabled":true}]'::jsonb
  ) ON CONFLICT (salon_id) DO NOTHING;

  INSERT INTO public.clients (id, salon_id, full_name, email, phone, notes, email_consent)
  VALUES (v_client_id, v_salon_id, 'Demo Client', 'demo.client@example.com', NULL, 'Synthetic local demo record', false)
  ON CONFLICT (id) DO NOTHING;
END;
$$;
