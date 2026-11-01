-- New salons started with a made-up address and phone, a bilingual booking title and an English,
-- epilation-only reminder email. Real clients saw the made-up address and phone on the booking page.
-- From now on new salons start with empty contact fields and plain Georgian texts, and salons that
-- never changed those values get the same clean defaults.

-- Plain Georgian texts, without em dashes, for any kind of salon.
ALTER TABLE public.salon_settings
  ALTER COLUMN salon_address SET DEFAULT '',
  ALTER COLUMN salon_phone SET DEFAULT '',
  ALTER COLUMN booking_title SET DEFAULT 'ონლაინ ჩაწერა',
  ALTER COLUMN booking_subtitle SET DEFAULT 'აირჩიეთ სერვისი, სპეციალისტი და თავისუფალი დრო.',
  ALTER COLUMN email_subject SET DEFAULT 'დროა ისევ გვეწვიოთ',
  ALTER COLUMN email_body_template SET DEFAULT E'გამარჯობა, {{client_name}}!\n\nბოლო ვიზიტიდან უკვე დრო გავიდა და სიამოვნებით გნახავთ ისევ.\n\nდაჯავშნეთ თქვენთვის მოსახერხებელი დრო:\n\n{{booking_link}}\n\nგელოდებით,\n{{salon_name}}';

-- Values that only ever came from the old signup and demo defaults.
CREATE OR REPLACE FUNCTION public.clean_salon_settings_defaults()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.salon_address IN ('თბილისი, ჭავჭავაძის გამზ. 34', 'თბილისი, ი. ჭავჭავაძის გამზ. 34') THEN
    NEW.salon_address := '';
  END IF;
  IF NEW.salon_phone IN ('+995 555 00 11 22', '+995 555 00 21 21') THEN
    NEW.salon_phone := '';
  END IF;
  IF NEW.booking_title = 'დაჯავშნეთ თქვენი ვიზიტი ონლაინ | Book Your Visit Online' THEN
    NEW.booking_title := 'ონლაინ ჩაწერა';
  END IF;
  IF NEW.booking_subtitle IN (
    'აირჩიეთ სერვისი, სპეციალისტი და თავისუფალი დრო. | Choose a service, staff member and available time.',
    'აირჩიეთ სასურველი პროცედურა და თავისუფალი საათი — ჯავშანი მყისიერად აისახება სალონის განრიგში.'
  ) THEN
    NEW.booking_subtitle := 'აირჩიეთ სერვისი, სპეციალისტი და თავისუფალი დრო.';
  END IF;
  IF NEW.email_subject = 'It''s time to book your next epilation appointment!' AND NEW.email_body_template LIKE 'Hi {{client_name}},%It''s been 21 days since your last epilation appointment%' THEN
    NEW.email_subject := 'დროა ისევ გვეწვიოთ';
    NEW.email_body_template := E'გამარჯობა, {{client_name}}!\n\nბოლო ვიზიტიდან უკვე დრო გავიდა და სიამოვნებით გნახავთ ისევ.\n\nდაჯავშნეთ თქვენთვის მოსახერხებელი დრო:\n\n{{booking_link}}\n\nგელოდებით,\n{{salon_name}}';
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.clean_salon_settings_defaults() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS clean_salon_settings_defaults ON public.salon_settings;
CREATE TRIGGER clean_salon_settings_defaults BEFORE INSERT ON public.salon_settings
  FOR EACH ROW EXECUTE FUNCTION public.clean_salon_settings_defaults();

-- Salons that still have the old values. The trigger above only runs on insert, so do it here once.
UPDATE public.salon_settings SET salon_address = ''
WHERE salon_address IN ('თბილისი, ჭავჭავაძის გამზ. 34', 'თბილისი, ი. ჭავჭავაძის გამზ. 34');
UPDATE public.salon_settings SET salon_phone = ''
WHERE salon_phone IN ('+995 555 00 11 22', '+995 555 00 21 21');
UPDATE public.salon_settings SET booking_title = 'ონლაინ ჩაწერა'
WHERE booking_title = 'დაჯავშნეთ თქვენი ვიზიტი ონლაინ | Book Your Visit Online';
UPDATE public.salon_settings SET booking_subtitle = 'აირჩიეთ სერვისი, სპეციალისტი და თავისუფალი დრო.'
WHERE booking_subtitle IN (
  'აირჩიეთ სერვისი, სპეციალისტი და თავისუფალი დრო. | Choose a service, staff member and available time.',
  'აირჩიეთ სასურველი პროცედურა და თავისუფალი საათი — ჯავშანი მყისიერად აისახება სალონის განრიგში.'
);
UPDATE public.salon_settings SET
  email_subject = 'დროა ისევ გვეწვიოთ',
  email_body_template = E'გამარჯობა, {{client_name}}!\n\nბოლო ვიზიტიდან უკვე დრო გავიდა და სიამოვნებით გნახავთ ისევ.\n\nდაჯავშნეთ თქვენთვის მოსახერხებელი დრო:\n\n{{booking_link}}\n\nგელოდებით,\n{{salon_name}}'
WHERE email_subject = 'It''s time to book your next epilation appointment!'
  AND email_body_template LIKE 'Hi {{client_name}},%It''s been 21 days since your last epilation appointment%';
