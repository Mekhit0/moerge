-- ==============================================================================
-- Migration: 20261016000002_seed_initial_salon_and_staff.sql
-- Description: Seeds the initial salon, pre-confirmed staff user account,
--              salon settings, sample clients, appointments, reminders, and email logs.
-- ==============================================================================

DO $$
DECLARE
  v_staff_user_id UUID := 'a1111111-1111-4111-8111-111111111111';
  v_salon_id UUID := '11111111-1111-4111-8111-111111111111';
  v_client_1 UUID := 'c1111111-1111-4111-8111-111111111111';
  v_client_2 UUID := 'c2222222-2222-4222-8222-222222222222';
  v_client_3 UUID := 'c3333333-3333-4333-8333-333333333333';
  v_client_4 UUID := 'c4444444-4444-4444-8444-444444444444';
  v_client_5 UUID := 'c5555555-5555-4555-8555-555555555555';
  v_appt_1 UUID := 'd1111111-1111-4111-8111-111111111111';
  v_appt_2 UUID := 'd2222222-2222-4222-8222-222222222222';
  v_appt_3 UUID := 'd3333333-3333-4333-8333-333333333333';
  v_appt_4 UUID := 'd4444444-4444-4444-8444-444444444444';
  v_appt_5 UUID := 'd5555555-5555-4555-8555-555555555555';
  v_rem_1 UUID := 'e1111111-1111-4111-8111-111111111111';
  v_rem_2 UUID := 'e2222222-2222-4222-8222-222222222222';
  v_rem_3 UUID := 'e3333333-3333-4333-8333-333333333333';
  v_rem_4 UUID := 'e4444444-4444-4444-8444-444444444444';
BEGIN
  -- 1. Create pre-confirmed staff user in auth.users (staff@lumieresalon.com / SalonStaff2026!)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'staff@lumieresalon.com') THEN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_staff_user_id,
      'authenticated',
      'authenticated',
      'staff@lumieresalon.com',
      extensions.crypt('SalonStaff2026!', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Camille Laurent"}'::jsonb,
      now(),
      now(),
      '',
      '',
      '',
      ''
    );

    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_staff_user_id,
      v_staff_user_id::text,
      jsonb_build_object(
        'sub', v_staff_user_id::text,
        'email', 'staff@lumieresalon.com',
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      now(),
      now(),
      now()
    );
  ELSE
    SELECT id INTO v_staff_user_id FROM auth.users WHERE email = 'staff@lumieresalon.com' LIMIT 1;
  END IF;

  -- 2. Create user profile
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (v_staff_user_id, 'staff@lumieresalon.com', 'Camille Laurent')
  ON CONFLICT (id) DO NOTHING;

  -- 3. Create Primary Salon
  INSERT INTO public.salons (id, name, slug, subscription_tier, subscription_status)
  VALUES (v_salon_id, 'Lumière Epilation & Beauty Studio', 'lumiere-epilation-studio', 'professional', 'active')
  ON CONFLICT (id) DO NOTHING;

  -- 4. Link Staff to Salon
  INSERT INTO public.salon_memberships (salon_id, user_id, role, is_active)
  VALUES (v_salon_id, v_staff_user_id, 'owner', true)
  ON CONFLICT (salon_id, user_id) DO NOTHING;

  -- 5. Configure Salon Settings
  INSERT INTO public.salon_settings (
    salon_id,
    salon_name,
    sender_display_name,
    verified_sender_email,
    timezone,
    reminder_interval_days,
    email_subject,
    email_body_template,
    booking_url,
    brand_color,
    auto_reminders_enabled,
    dry_run_mode,
    test_recipient_email
  ) VALUES (
    v_salon_id,
    'Lumière Epilation & Beauty Studio',
    'Lumière Epilation Studio',
    'reminders@lumieresalon.com',
    'America/New_York',
    21,
    'It''s time to book your next epilation appointment!',
    E'Hi {{client_name}},\n\nIt''s been 21 days since your last epilation appointment, and we''d love to welcome you back!\n\nIt''s a great time to plan your next visit.\n\nReady to book your next appointment?\n\n{{booking_link}}\n\nThank you for choosing {{salon_name}}. We look forward to seeing you again!\n\nBest regards,\n{{salon_name}} Team',
    'https://lumieresalon.com/book',
    '#e11d48',
    true,
    true,
    ''
  )
  ON CONFLICT (salon_id) DO NOTHING;

  -- 6. Seed Clients
  INSERT INTO public.clients (
    id, salon_id, full_name, email, phone, notes, email_consent, is_archived,
    last_completed_epilation_date, next_expected_appointment_date
  ) VALUES
    (
      v_client_1, v_salon_id, 'Sophia Beaumont', 'sophia.beaumont@example.com', '+1 (212) 555-0142',
      'Prefers diode laser epilation (full legs & underarms). Sensitive skin lotion after session.',
      true, false, (CURRENT_DATE - 10), (CURRENT_DATE + 11)
    ),
    (
      v_client_2, v_salon_id, 'Elena Rostova', 'elena.rostova@example.com', '+1 (212) 555-0188',
      'Regular 3-week sugaring epilation cycle.',
      true, false, (CURRENT_DATE - 21), CURRENT_DATE
    ),
    (
      v_client_3, v_salon_id, 'Amélie Delacroix', 'amelie.delacroix@example.com', '+1 (212) 555-0194',
      'Completed full-body laser epilation 3 weeks ago; reminder already delivered.',
      true, false, (CURRENT_DATE - 24), (CURRENT_DATE - 3)
    ),
    (
      v_client_4, v_salon_id, 'Clara Vance', 'clara.vance@example.com', NULL,
      'New client scheduled for upcoming laser epilation session.',
      true, false, NULL, (CURRENT_DATE + 3)
    ),
    (
      v_client_5, v_salon_id, 'Naomi Sterling', 'naomi.sterling@example.com', '+1 (212) 555-0167',
      'Check email address on next visit — previous reminder failed temporary delivery.',
      true, false, (CURRENT_DATE - 22), (CURRENT_DATE - 1)
    )
  ON CONFLICT (id) DO NOTHING;

  -- 7. Seed Appointments
  INSERT INTO public.appointments (
    id, salon_id, client_id, treatment_date, treatment_time, treatment_type, is_epilation,
    status, completed_at, next_expected_date, notes, created_by
  ) VALUES
    (
      v_appt_1, v_salon_id, v_client_1, (CURRENT_DATE - 10), '11:00:00', 'laser_epilation', true,
      'completed', (now() - interval '10 days'), (CURRENT_DATE + 11),
      'Session #4 completed smoothly. 21-day reminder scheduled.', v_staff_user_id
    ),
    (
      v_appt_2, v_salon_id, v_client_2, (CURRENT_DATE - 21), '14:30:00', 'sugaring_epilation', true,
      'completed', (now() - interval '21 days'), CURRENT_DATE,
      'Full legs sugaring epilation completed. Due for 21-day reminder today.', v_staff_user_id
    ),
    (
      v_appt_3, v_salon_id, v_client_3, (CURRENT_DATE - 24), '10:00:00', 'epilation', true,
      'completed', (now() - interval '24 days'), (CURRENT_DATE - 3),
      'Standard epilation treatment completed.', v_staff_user_id
    ),
    (
      v_appt_4, v_salon_id, v_client_4, (CURRENT_DATE + 3), '15:30:00', 'laser_epilation', true,
      'scheduled', NULL, NULL,
      'Initial laser epilation session.', v_staff_user_id
    ),
    (
      v_appt_5, v_salon_id, v_client_5, (CURRENT_DATE - 22), '16:00:00', 'wax_epilation', true,
      'completed', (now() - interval '22 days'), (CURRENT_DATE - 1),
      'Wax epilation completed.', v_staff_user_id
    )
  ON CONFLICT (id) DO NOTHING;

  -- 8. Seed Reminders
  INSERT INTO public.reminders (
    id, salon_id, client_id, appointment_id, scheduled_for_date, scheduled_send_at,
    actual_sent_at, delivered_at, status, idempotency_key, provider_message_id,
    attempt_count, max_attempts, failure_reason, is_permanent_failure
  ) VALUES
    (
      v_rem_1, v_salon_id, v_client_1, v_appt_1,
      (CURRENT_DATE + 11), (now() + interval '11 days'),
      NULL, NULL, 'scheduled',
      'rem:' || v_salon_id::text || ':' || v_appt_1::text || ':' || (CURRENT_DATE + 11)::text,
      NULL, 0, 3, NULL, false
    ),
    (
      v_rem_2, v_salon_id, v_client_2, v_appt_2,
      CURRENT_DATE, (now() - interval '15 minutes'),
      NULL, NULL, 'scheduled',
      'rem:' || v_salon_id::text || ':' || v_appt_2::text || ':' || CURRENT_DATE::text,
      NULL, 0, 3, NULL, false
    ),
    (
      v_rem_3, v_salon_id, v_client_3, v_appt_3,
      (CURRENT_DATE - 3), (now() - interval '3 days'),
      (now() - interval '3 days' + interval '2 minutes'),
      (now() - interval '3 days' + interval '3 minutes'),
      'delivered',
      'rem:' || v_salon_id::text || ':' || v_appt_3::text || ':' || (CURRENT_DATE - 3)::text,
      're_msg_delivered_demo_001', 1, 3, NULL, false
    ),
    (
      v_rem_4, v_salon_id, v_client_5, v_appt_5,
      (CURRENT_DATE - 1), (now() - interval '1 day'),
      NULL, NULL, 'failed',
      'rem:' || v_salon_id::text || ':' || v_appt_5::text || ':' || (CURRENT_DATE - 1)::text,
      NULL, 3, 3, 'Upstream SMTP gateway timeout after 3 retry attempts', false
    )
  ON CONFLICT (id) DO NOTHING;

  -- 9. Seed Email Logs
  INSERT INTO public.email_logs (
    salon_id, reminder_id, client_id, appointment_id, recipient_email, subject,
    event_type, provider_message_id, idempotency_key, attempt_number, status_code, error_message, is_dry_run
  ) VALUES
    (
      v_salon_id, v_rem_3, v_client_3, v_appt_3,
      'amelie.delacroix@example.com',
      'It''s time to book your next epilation appointment!',
      'api_accepted', 're_msg_delivered_demo_001',
      'rem:' || v_salon_id::text || ':' || v_appt_3::text || ':' || (CURRENT_DATE - 3)::text,
      1, 200, NULL, false
    ),
    (
      v_salon_id, v_rem_3, v_client_3, v_appt_3,
      'amelie.delacroix@example.com',
      'It''s time to book your next epilation appointment!',
      'delivered', 're_msg_delivered_demo_001',
      'rem:' || v_salon_id::text || ':' || v_appt_3::text || ':' || (CURRENT_DATE - 3)::text || ':delivered',
      1, 200, NULL, false
    ),
    (
      v_salon_id, v_rem_4, v_client_5, v_appt_5,
      'naomi.sterling@example.com',
      'It''s time to book your next epilation appointment!',
      'failed', NULL,
      'rem:' || v_salon_id::text || ':' || v_appt_5::text || ':' || (CURRENT_DATE - 1)::text,
      3, 504, 'Upstream SMTP gateway timeout after 3 retry attempts', false
    );
END;
$$;
