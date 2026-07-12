
# Barber Module — Single Profile, Three Roles

## Goal
One profile page at `src/routes/barbers.$barberId.tsx` renders for customer / barber / owner. Same layout, same components. Edit controls appear inline only when `canEdit` is true.

## Architecture

### 1. Permission model
Add a `useBarberPermissions(barberId)` hook that returns:
- `canEdit: boolean` — true if current user is the barber (`barbers.profile_id === user.id`) OR an owner of the shop (`shops.manager_id === user.id`) OR super_admin.
- `role: "customer" | "self" | "owner" | "admin"`

### 2. Refactor `barbers.$barberId.tsx`
Keep the existing UI untouched. Wrap editable regions with an `<Editable>` component that:
- When `!canEdit`: renders children as-is (pixel-identical to current customer view).
- When `canEdit`: renders children + a small floating pencil button; click swaps to inline editor (input/textarea/upload), Save/Cancel, optimistic React Query update.

Editable regions:
- Profile photo (upload/remove)
- Bio (about tab textarea EN + AR)
- Title / display name
- Years experience
- Specialties (add/remove chips)
- Services — per row: enable toggle + inline edit fields; owner sees "+ Add service"
- Portfolio — "+ Add photo" tile + delete-on-hover per photo

### 3. Server functions
Add `src/lib/barber-profile.functions.ts`:
- `updateBarberField({ id, patch })` — validates `canEdit`, updates allowed fields.
- `uploadBarberPhoto` / `removeBarberPhoto`
- `toggleBarberService({ barberId, serviceId, enabled })`
- `upsertService` / `deleteService` (owner-only for CRUD; barber can only toggle)
- `addPortfolioPhoto` / `deletePortfolioPhoto`
- `updateAvailability({ barberId, workingDays, workingHours, break, appointmentDurationMin })`

All use `requireSupabaseAuth` + server-side permission check.

### 4. Barber dashboard (`/_authenticated/barber`)
Replace stats-only page with 4-item sidebar layout mirroring owner-layout:
- **Dashboard** (`/barber`) — Today's bookings, Upcoming, Completed count, Today's schedule, Current availability summary. Each booking: Complete / Cancel / No-show buttons.
- **Bookings** (`/barber/bookings`) — filters Today/Upcoming/Completed/Cancelled; columns customer/service/price/time/status + actions.
- **My Profile** (`/barber/profile`) — renders the SAME `<BarberProfilePage>` component with the current user's barber id (edit mode active).
- **Settings** (`/barber/settings`) — availability config (working days, hours, break, appointment duration). Booking engine reads these to generate slots.

Remove Analytics / Customers / Reviews / Portfolio pages from barber nav.

### 5. Availability model
`barber_availability` already exists (5 cols). Extend/reuse to store:
- `weekday` (0–6), `start_time`, `end_time`, `break_start`, `break_end`, `is_off`
Plus a new `barbers.appointment_duration_min` column (default 30).

Slot generation in existing `src/lib/slots.ts` reads these and emits slots — no manual slot creation.

## Out of scope
- Do NOT redesign the customer profile.
- Do NOT create parallel profile components.
- Do NOT touch reviews (read-only for all roles).

## Files touched
- `src/routes/barbers.$barberId.tsx` (wrap regions with `<Editable>`)
- NEW `src/components/barber/editable.tsx`
- NEW `src/lib/use-barber-permissions.ts`
- NEW `src/lib/barber-profile.functions.ts`
- NEW `src/components/barber/barber-layout.tsx` (sidebar)
- REWRITE `src/routes/_authenticated/barber.tsx` → dashboard
- NEW `src/routes/_authenticated/barber.bookings.tsx`
- NEW `src/routes/_authenticated/barber.profile.tsx` (renders barber profile with self id)
- NEW `src/routes/_authenticated/barber.settings.tsx`
- Migration: `alter table barbers add column appointment_duration_min int default 30`; ensure `barber_availability` has break columns + RLS for self-edit.

## Approval
This is a large change (~15 files, 1 migration). Confirm before I start, or tell me which slice to build first (recommend: permission hook + inline-edit wiring on the existing profile page, then dashboard).
