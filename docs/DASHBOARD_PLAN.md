# Salon dashboard plan (2026-10-31)

Goal: a salon that used paper or Excel runs the whole day from MOARGE without training.
Colors stay exactly as they are (ivory, rose, stone, emerald, amber, red). Georgian first.

## 0. Decisions (from the owner, 2026-10-31)

| Question | Decision |
|---|---|
| Who logs in | Everyone: the salon owner, receptionists and every master on their own phone |
| What masters see | Only their own visits, including those clients' phone numbers |
| Payments | Cash and card, plus discounts and tips |
| Master pay | Commission is part of one combined **Earnings and analytics** section |
| CRM | Wanted, and it must be a good one (section 5) |
| Devices | Main working device is the **reception tablet**. The **main account** is the owner who created the salon; it controls team, money and settings |

## 1. Where we are today (audit)

| Screen | What works | What is wrong |
|---|---|---|
| Today | Schedule, next visit, expected income, setup checklist, QR | Cannot act on a visit (arrived, done, paid) |
| Calendar | Day and week staff calendar, drag to move, time blocks | **Two calendars on one page**, full page reload after drag, fixed 08:00 to 21:00 grid, loads 1,000 appointments and every client |
| Clients | List, search, CSV import/export, profile with history, tags, block | Thin profile, import needs exact English column names, no quick actions |
| Income | Revenue, bookings, no-show rate, by staff, top services | Revenue is guessed from prices; nothing records what was paid |
| Settings | Everything exists somewhere | One 1,590-line salon screen, services and staff cannot be edited inline, same hours every day, no breaks in the UI, reminder texts in two places |
| Team | Roles owner, admin, staff exist in the database | **No invites.** Masters are not linked to logins |

## 2. Roles

| Role | Who | Sees | Can do |
|---|---|---|---|
| Owner (main account) | Created the salon | Everything | Everything; only the owner manages team, commission rates, money settings and can transfer ownership |
| Admin | Receptionist, manager | Calendar of all masters, clients, today, payments | Book, move, cancel, check in, take payment, manage clients. Earnings only if the owner allows it |
| Master | Specialist | **Own** visits and the clients of those visits, including phone numbers | Mark arrived, done, no-show; add visit notes; block own time; see own earnings |

Enforced on the server and in RLS, never only in the UI (AGENTS rule 6).

## 3. Visit lifecycle (the core logic every screen follows)

```
booked ──> arrived ──> done ──> paid
   │          │
   ├──> canceled (by client or salon)
   └──> no-show
```

- Same buttons in the same place everywhere: **Arrived**, **Done**, **Pay**, plus a menu for Move, Cancel, No-show.
- **Pay sheet:** price pre-filled from the service; discount (amount or %); tip; method cash or card (split allowed);
  total shown large; one tap to confirm. A receipt line is stored, not printed.
- Every change is optimistic (instant on screen, rolled back with a message if refused) and written to the audit log.
- The same visit card is used on Today, Calendar and the client profile.

## 4. Screens

Navigation: Today, Calendar, Clients, Earnings, Settings. Masters see Today, Calendar, their clients and their own earnings.

### 4.1 Today
- Numbers: visits left, expected income, paid today.
- "Now and next": current visit per master with one-tap Arrived, Done, Pay.
- Timeline grouped by master. Setup checklist until finished. Booking link and QR.

### 4.2 Calendar (one calendar)
- Default **day view with one column per master**, using the salon's real hours.
- Built tablet-first for reception (landscape, large targets); on phones one master at a time with swipe.
- Week view per master; month overview with counts.
- Tap empty slot: new booking sheet pre-filled. Tap visit: visit sheet with actions.
- Drag to move with conflict check, no reload. Loads only the visible range.

### 4.3 New booking sheet (reused everywhere)
Client (search name or phone, or new with name and phone) → service → master and free times as chips → save.

### 4.4 Clients (CRM, see section 5)

### 4.5 Earnings and analytics (section 6)

### 4.6 Settings
- Salon: name, address, phone, booking page texts, cancellation deadline.
- Services: inline edit, reorder, categories, hide from online booking.
- Team: masters (name, color, photo, services, hours, commission %) and **invite by email** with a role.
- Hours: per master, per weekday, with breaks; days off with a simple date picker.
- Reminders: one place for all message texts and channels.
- Owner only: ownership transfer, permissions (can admins see earnings).

## 5. CRM

The client card is the heart of the salon. It must answer "who is this, what did we do, what should we do next".

**Client card**
- Contact: name, phone (tap to call, Viber and WhatsApp links), email, birthday, preferred master, language.
- Notes that matter in a salon: allergies, skin and hair notes, color formulas, a pinned important note.
- Timeline: every visit with service, master, paid amount, tip, notes; cancellations and no-shows.
- Numbers: total spent, average check, visit count, last and next visit, average days between visits, no-show count.
- Tags (VIP, sensitive skin, and own tags), consent status, block.

**Segments (automatic lists)**
- New (first visit in last 30 days), Regular, VIP (top spenders), **At risk** (no visit for longer than usual),
  **Lost** (no visit in 90+ days), **Due to return** (service recall date reached), Birthdays this week, Frequent no-shows.
- Each list has one-tap actions: call, book, and later send SMS when uBill is live.

**Data quality**
- Duplicate detection by phone with merge.
- Import from Excel or CSV with column mapping and preview; export at any time.

## 6. Earnings and analytics

One section, filtered by period (today, week, month, custom) with comparison to the previous period.

**Money**
- Paid revenue, by method (cash, card), discounts given, tips (kept separate, they belong to the master).
- Average check, expected vs paid.

**Masters**
- Per master: visits, revenue, average check, tips, occupancy, no-shows.
- **Commission:** default % per master, optional % per service. Calculated on the paid amount after discount;
  tips are added to the master in full. Payout summary per period with Excel export.

**Clients and demand**
- New vs returning, retention rate, top services, cancellations and no-shows.
- Busiest days and hours (heatmap), occupancy % (booked minutes / working minutes).

Masters see only their own numbers. Admins see money only if the owner allows it.

## 7. Shared UI system

Component kit in `src/components/ui/`: Button, IconButton, Card, Sheet (bottom on phone, side panel on tablet and desktop),
Dialog, Tabs, Chip, Badge (visit status colors), Input, Select, DatePicker (day chips), TimeChips, EmptyState,
Skeleton, Toast, StatCard, simple bar and heatmap charts. Color tokens defined once in `globals.css` with the current palette.

Rules: touch targets at least 44px, one primary button per screen, Georgian labels without jargon,
empty state and loading skeleton for every list, feedback within 100 ms.

## 8. System work

| Need | Change |
|---|---|
| Everyone can sign in | `staff.user_id` link, `team_invites` table (email, role, staff, expiring token), invite email, accept page |
| Role-aware data | RLS and API checks: masters read only their own appointments and those clients |
| Owner protection | Only the owner changes roles, commission and money settings; ownership transfer flow |
| Payments | `visit_payments` (appointment, amount, discount, tip, method, split, taken by, time) with RLS and audit |
| Commission | `staff.commission_percent`, optional `staff_service_commission` overrides |
| CRM | Client fields (birthday, preferred master, pinned note), `client_notes`, segment queries, duplicate merge |
| Status changes | One validated server action per transition |
| Calendar data | Range API returning only the visible days and masters |
| Hours | Per-day ranges and breaks in the UI (database already supports `is_break`) |
| Speed | No full reloads, optimistic updates, skeletons, prefetch |

## 9. Build order

Each step ships on its own, keeps tests green, includes migrations tested on a local database first, and is checked
on tablet, phone and desktop sizes.

1. **UI kit and tokens**
2. **Visit lifecycle and Pay sheet** (cash, card, discount, tip) on Today
3. **One calendar**, tablet-first, day view by master
4. **New booking sheet** reused everywhere
5. **Team invites, roles and master view** (everyone signs in)
6. **CRM**: client card, notes, segments, duplicates
7. **Earnings and analytics** with commission and payouts
8. **Settings rebuilt**: inline services and team, hours with breaks, one reminders page
9. Import with column mapping

## 10. Not in this plan

Online card payments from clients, deposits, loyalty points, inventory, multiple branches UI, SMS campaigns (wait for uBill).
