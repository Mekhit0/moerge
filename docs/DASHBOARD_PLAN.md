# Salon dashboard plan (draft, 2026-10-31)

Goal: a salon manager who used paper or Excel runs the whole day from one screen, on a phone or a reception tablet,
without training. Colors stay exactly as they are (ivory, rose, stone, emerald, amber, red). Georgian first.

## 1. Where we are today (audit)

| Screen | What works | What is wrong |
|---|---|---|
| Today (`/dashboard`) | New: schedule, next visit, expected income, setup checklist, QR | Cannot act on a visit from here (mark arrived, done, paid) |
| Calendar (`/appointments`) | Day and week staff calendar, drag to move, time blocks | **Two calendars on one page** (StaffCalendar on top, AppointmentsManager list/calendar below). Full page reload after drag. Fixed 08:00 to 21:00 grid. Loads 1,000 appointments and every client |
| Clients | List, search, CSV import/export, profile with history, tags, block | Import needs exact English column names. No quick "call / book again" actions in the list |
| Income (`/reports`) | Revenue, bookings, no-show rate, by staff, top services | Revenue is guessed from prices. No record of what was actually paid, cash or card |
| Settings: salon | Works | One 1,590-line screen mixing salon details, booking page texts and email template |
| Settings: services, staff | Add and list | Cannot edit or remove inline, no ordering, no colors, no photos |
| Settings: hours | Same hours for every selected day | No different hours per day, no lunch break (the database already supports breaks) |
| Settings: days off | Works | Raw date-time inputs, hard on phones |
| Reminders, sent reminders | Works | Two places for templates (salon settings and notifications page) |
| Team access | Roles owner, admin, staff exist in the database | **No way to invite anyone.** Staff records are not linked to logins, so a master cannot sign in to see their own day |

## 2. Who uses it (roles)

| Role | Typical person | Sees | Can do |
|---|---|---|---|
| Owner | Salon owner | Everything | Everything, including team, income, settings |
| Admin | Receptionist or manager | Calendar, clients, today, income (optional) | Book, move, cancel, check in, take payment, manage clients |
| Master (staff) | Specialist | **Their own** day and week, their clients for those visits | Mark arrived, done, no-show; add notes; block their own time |

Permissions are enforced on the server and in RLS, never only in the UI (AGENTS rule 6).

## 3. The visit lifecycle (the core logic every screen follows)

```
booked ──> arrived ──> done ──> paid
   │          │
   ├──> canceled (by client or salon)
   └──> no-show
```

- One action per state, always the same button in the same place: **Arrived**, **Done**, **Paid**, plus a menu for Move, Cancel, No-show.
- "Done" opens payment right away: amount (pre-filled from the price), cash or card, optional discount. One tap to confirm.
- Every change is optimistic (instant on screen, rolled back with a message if the server refuses) and written to the audit log.
- The same visit card is used everywhere: Today, Calendar, Client profile.

## 4. Screens (target design)

Navigation stays at five sections: Today, Calendar, Clients, Income, Settings (masters see Today and Calendar only).

### 4.1 Today
- Top: date, three numbers (visits left, expected income, paid today).
- "Now and next" card: current visit per master, next client, with one-tap Arrived or Done.
- Timeline of the day, grouped by master when there are several.
- Setup checklist until finished. Booking link and QR card.

### 4.2 Calendar (one calendar, not two)
- **Day view by master** as default: columns = masters, rows = the salon's real working hours (not 08 to 21).
- Week view per master. Month view as a simple overview with counts.
- Tap empty slot: new booking sheet pre-filled with master and time. Tap visit: visit sheet with actions.
- Drag to move with conflict check; no page reload.
- Loads only the visible range; prefetches the next day.
- Phone: one master at a time with swipe between masters; tablet and desktop: all columns.

### 4.3 New booking sheet (used from every screen)
1. Client: search by name or phone, or "new client" with just name and phone.
2. Service (with price and length shown).
3. Master and time: suggested free times shown as chips.
4. Save. Optional note. Same rules as online booking.

### 4.4 Clients
- Search first; list shows last visit, next visit, visit count, no-show count.
- Row actions: Call, Book again, Open.
- Profile: contact, notes and allergies, visit history with what was paid, total spent, block.
- Import: Excel or CSV with column mapping and a preview (Phase 4 of the roadmap).

### 4.5 Income
- Paid today, this week, this month; cash vs card.
- By master (count, revenue, optional commission %), by service.
- No-shows and cancellations.
- Export to Excel.

### 4.6 Settings
- Salon: name, address, phone, booking page texts, cancellation deadline.
- Services: list with inline edit, reorder, hide from online booking, category.
- Team: masters (name, color, photo, services, hours) and **invite by email** with a role.
- Hours: per master, per weekday, with breaks; salon-wide days off with a simple date picker.
- Reminders: one place for all message texts and channels.
- Account: password, language.

## 5. Shared UI system (build once, reuse everywhere)

To make every screen consistent and smooth, introduce a small component kit in `src/components/ui/`:
Button, IconButton, Card, Sheet (bottom sheet on phone, side panel on desktop), Dialog, Tabs, Chip, Badge
(visit status colors), Input, Select, DatePicker (day chips like the booking form), TimeChips, EmptyState,
Skeleton, Toast. Color tokens defined once in `globals.css` with the current palette, so nothing drifts.

Rules: touch targets at least 44px, one primary button per screen, Georgian labels without jargon,
every list has an empty state and a loading skeleton, every action gives feedback within 100 ms.

## 6. System work behind the screens

| Need | Change |
|---|---|
| Masters can sign in | `staff.user_id` link, invite table with expiring token, invite email, accept page |
| Role-aware data | RLS and API checks: masters read only their own appointments and those clients' basic fields |
| Visit payments | `visit_payments` table (appointment, amount, method cash/card, discount, taken by, time) with RLS and audit |
| Status changes | One server action per transition, validated (cannot mark paid before done, etc.) |
| Calendar data | Range-based API `/api/calendar?from&to&staff` returning only what is visible |
| Hours with breaks | UI for per-day ranges and breaks (database already supports `is_break`) |
| Speed | No full reloads, optimistic updates, skeletons, prefetch, fewer large client components |

## 7. Build order

Each step ships on its own, keeps tests green, and is checked on phone and desktop sizes.

1. **UI kit and tokens** (no visible feature change).
2. **Visit lifecycle + visit sheet + payments** (Today becomes fully actionable).
3. **One calendar** (replace the two current ones, day view by master, drag without reload).
4. **New booking sheet** reused everywhere.
5. **Team invites and master view** (masters sign in and see their own day).
6. **Settings rebuilt**: services and team inline editing, hours with breaks, one reminders page.
7. **Income** on real payments, by master and method, Excel export.
8. **Clients** list actions and import with column mapping.

## 8. Not in this plan

Online card payments from clients, deposits, loyalty, inventory, multiple branches UI, SMS sending (waits for uBill).
