## Owner Dashboard — Phased Build Plan

The specification is ~4,000 lines covering 8 major sections (Dashboard, Salon Management, Services, Barbers, Bookings & Calendar, Customers & Reviews, Analytics, Settings). Building all of it in one turn would be irresponsible — each section is itself a multi-page module touching dozens of tables, RLS policies, and UI flows. I will deliver it section by section, verifying each before moving on, exactly as the spec requires.

### Foundation (built once, used by every section)

1. **Owner shell & routing**
   - New protected layout `src/routes/_authenticated/owner.tsx` with sidebar (Dashboard, Bookings, Calendar, Customers, Barbers, Services, Portfolio, Reviews, Analytics, Salon, Settings, Support, Logout).
   - `role-routing` already sends owners to `/owner`; extend it to `/owner` as the new dashboard home.
   - Header: greeting, salon name, date/time, last sync, notifications, profile menu.
   - Route guard: `requireSupabaseAuth` + `has_role(uid,'owner')`; redirect non-owners.

2. **Owner data layer (`src/lib/owner.functions.ts`)**
   - All reads/writes go through `createServerFn` + `requireSupabaseAuth`.
   - Helper `getOwnerShopId(userId)` reused everywhere — every query is scoped to that shop.
   - RLS audit: confirm `shops`, `barbers`, `bookings`, `services`, `reviews`, `invites`, `shop_hours`, `portfolio_photos`, `notifications` policies allow owner access only when `manager_id = auth.uid()`. Add missing policies via migration if needed.

### Section 1 — Dashboard (this turn's deliverable)

Route: `/_authenticated/owner/index.tsx`

- **KPI cards** (live SQL):
  1. Today's Bookings + delta vs yesterday
  2. Occupancy rate = booked-minutes / available-minutes today
  3. Available barbers breakdown (Working / Busy / Break / Off)
  4. Pending reviews (no owner reply)
  5. New customers this week (distinct customer_id first booked in last 7d)
  6. Revenue — placeholder card marked "Coming soon" (architecture only)
- **Today's Schedule** timeline with status chips; click opens `BookingDrawer` (no navigation) showing customer, phone, service, duration, price, barber, notes, status, quick actions (confirm / cancel / no-show / reschedule).
- **Quick Actions** bar: Create Booking, Invite Barber, Add Service, Edit Salon, Open Calendar.
- **Recent Activity** from `audit_logs` filtered to this shop.
- **Pending Invitations** list (copy link, resend, cancel) from `invites`.
- **Recent Reviews** with Reply button (opens drawer).
- **Barber Status** cards (photo, name, status, current booking, today's count).
- **Today Performance**: Completed / Upcoming / Cancelled / No-show / Avg rating.
- Auto-refresh: TanStack Query `refetchInterval: 30s` + Supabase realtime channel on `bookings` invalidating queries.

Verification checklist before Section 2:
- All KPIs read real data — no mocks.
- RLS denies access when signed in as another owner.
- Sidebar navigation renders; non-owner roles get redirected.
- Mobile (375px), tablet, desktop layouts pass visual check via Playwright screenshot.
- No console errors; build & typecheck pass.

### Sections 2–8 (subsequent turns, one per turn)

Each will land as its own approved scope with the same verification gate:

2. **Salon Management** — 10 sub-sections, image uploads (needs new `salon-media` storage bucket), auto-save, working hours, holidays, visibility, danger zone.
3. **Services** — categories table (new migration), services CRUD with image, barber assignment matrix, bulk actions, analytics rollups.
4. **Barbers & Team** — invitation flow (reuses existing `invites`), profiles, working hours, vacations, assigned services, portfolio uploads, performance.
5. **Bookings & Calendar** — list + day/week/month calendar, drag-to-reschedule, conflict detection, status transitions.
6. **Customers & Reviews** — customer list scoped to owner's bookings, review replies, customer detail drawer.
7. **Analytics** — charts (Recharts) for bookings, revenue placeholders, top services, top barbers, retention.
8. **Settings** — notifications, locale, team permissions stub, support contact.

### Open questions before I start Section 1

1. **Revenue card** — the spec says "future-ready, do not calculate payments yet." Confirm: render a card with "Coming soon" badge and no number? (My default.)
2. **Realtime** — Supabase realtime adds load. OK to use Postgres changes channel on `bookings`/`reviews`/`invites` scoped to the owner's shop, fallback to 30s polling?
3. **Notifications icon** — should it open a panel reading from the existing `notifications` table, or just route to `/owner/notifications` for now?

I'll proceed with sensible defaults (Coming-soon revenue, realtime + polling, notification icon → panel reading `notifications`) unless you say otherwise. Approve this plan and I'll ship Section 1.