# moarge roadmap (draft, 2026-10-31)

Who we sell to: Georgian salon owners and masters who run their day on paper or Excel today.
They are not technical. If a screen needs explaining, it is too hard.

## Fixed rules for every phase

- **Colors stay exactly as they are.** Ivory background `#fdf8f6`, rose accent (rose-600 `#e11d48` and its tints),
  stone for text and borders, emerald for success, amber for warnings, red for errors. No new palette, no dark mode.
- **Georgian first, always.** The server renders Georgian by default. English is a manual switch only.
- **Fit the free tiers** (Supabase Free, Vercel Hobby) for as long as possible. See "Hosting limits" below.
- The AGENTS.md hard rules still apply: secrets only in env, migrations only as new files, RLS everywhere, tests pass after every step.

## What competitors teach us

| Competitor | What they do well (copy) | What owners complain about (avoid) |
|---|---|---|
| Fresha | Free core app, polished booking page, marketplace that brings new clients | ~20% commission on "new" marketplace clients, sometimes charged on clients the salon brought itself; fees stack up |
| Booksy | Booking, payments, marketing and reports in every plan | Per-staff pricing, extra fees for SMS, slow support |
| Altegio (ex YCLIENTS), popular in Georgia | Deep client cards (history, notes, tags), loyalty and bonuses, prepayments, blacklist, duplicate merge | Priced per employee in USD, best price needs a long commitment, only a 7-day trial, complex for small salons |
| Vagaro | Full feature set | The client must create an account to book |
| Square Appointments | Free tier for a single master, deposits | Not built for Georgia (no GEL, no Georgian) |

**Our position:** simple Georgian-language software at a flat price in GEL. No commission, no contracts,
clients book without creating an account, and support over phone or Viber in Georgian.

## Phase 1: Hosting and the moarge.com domain

- Replace the hardcoded `moarge.vercel.app` (metadata, sitemap, robots, settings preview) and the `moarge.ge` fallbacks with one URL helper that reads `NEXT_PUBLIC_APP_URL`. Fail loudly if it is missing.
- Owner tasks: set the env var in Vercel, set the Site URL and Redirect URLs in Supabase Auth, update the Turnstile hostname and the Resend domain and webhook.
- Contact addresses use `@moarge.com` (moarge.ge is not owned).

## Pilot (decided 2026-10-31)

- One month with 5 salons, each with up to 10 staff. The owner is recruiting them.
- Reminders: SMS first (clients read SMS more than Viber or WhatsApp).
- Hosting: free tiers during the pilot. Move to paid plans before the first paying salon.

## Phase 2: Simple dashboard (biggest selling point)

Today the sidebar has 11 items and uses words like "Dry-Run", "/book", "Presets", "Headline" and "Settings Cloud".

- **Five main sections:** Today (დღეს), Calendar (კალენდარი), Clients (კლიენტები), Money (შემოსავალი), Settings (პარამეტრები). Staff, services, schedules, time off and notifications move inside Settings.
- **"Today" home screen:** a timeline of today's visits, one big "+ New booking" button, today's earnings, and who is next.
- **Phones:** a bottom tab bar, large touch targets, a booking form that fits one screen.
- **Plain language:** no technical terms or paths. Every empty screen says in one sentence what to do next.
- **First-run checklist** instead of a long settings form: add a service, add a master, set hours, share your booking link (with a QR code).
- Booking in 3 taps: pick a time slot on the calendar, type a phone number or name, pick a service.

## Phase 3: Smooth everywhere

- The calendar updates in place after drag, block or status change (no `window.location.reload`), using the salon's own working hours and the Tbilisi timezone.
- Load only the visible date range. Stop loading 1,000 appointments plus every client on every visit.
- Search clients on the server as the user types instead of sending the whole list.
- Instant feedback on saves (optimistic UI), with undo where it matters.
- A loading skeleton for each page, and link prefetching.
- Georgian rendered on the server, so text never flashes.
- Split `SettingsManager`, `AppointmentsManager` and the landing page into small components.

## Phase 4: Getting off paper and Excel

- Import from Excel (.xlsx) or CSV with **any** column names. Show a preview and let the owner map the columns (name, phone, notes, last visit). Today the import accepts only CSV with exact English headers `full_name` and `phone`.
- Paste rows copied from Excel straight into the page.
- Merge duplicate clients (same phone).
- Print today's schedule and export everything back to Excel at any time ("your data is yours").

## Phase 5: Missing features that salons expect

In order of value for a small Georgian salon:

1. **Payment at checkout:** mark a visit paid by cash or card, with an optional discount. Gives the daily and monthly earnings shown on the Money screen.
2. **Staff earnings:** a percentage or fixed amount per service, and a monthly summary for each master.
3. **Richer client card:** notes, allergies, color formulas, visit history, total spent, no-show count, and a blacklist option.
4. **Reminders where clients actually read them:** SMS through uBill now. Ask whether Viber or WhatsApp should follow.
5. **Booking link everywhere:** Instagram bio, Facebook, Google Maps, QR code for the reception desk.
6. **Waitlist and recurring visits** (for example, every 4 weeks).
7. Later: loyalty points or discounts, gift cards, product inventory.

## Phase 6: Cleanup found in the audit

- `/api/clients` uses an in-memory rate limiter. Move it to the database limiter.
- The middleware skips the login check when the Supabase env is missing, and its protected list leaves out `/reports`, `/billing`, `/platform` and `/onboarding`.
- Remove em dashes from the copy (32 found). Rewrite the default reminder email: it hardcodes "21 days" and epilation wording.
- The brand color setting is saved but never used. Hide it (colors stay fixed).
- Move from `next lint` to the ESLint CLI before Next 16.

## Hosting limits

| | Free tier | When it becomes a problem |
|---|---|---|
| Supabase Free | 500 MB database, 50k monthly users, 2 projects | Pauses after about a week without activity. Fine while testing. Before the first paying salon, move to Pro or keep the project active |
| Vercel Hobby | Generous traffic; cron once a day | Terms allow **non-commercial use only**. Selling subscriptions requires Pro. Reminder cron must run from Supabase `pg_cron`, which already works on Free |

500 MB holds tens of thousands of appointments, so space is not the first limit. The first limits are the pausing and the Vercel terms.
Verify the current terms on vercel.com/pricing and supabase.com/pricing before launch.
