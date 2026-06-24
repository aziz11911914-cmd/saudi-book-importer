
# Barber Marketplace — MVP Plan (v2)

A premium, mobile-first marketplace for Saudi Arabia where customers discover **barbers first**, browse their portfolios like Instagram, and book appointments. Inspired by Fresha's flows but with a **black & gold** premium identity.

## 1. MVP Scope (locked)

**In:**
- Bilingual UI — **Arabic (RTL) is default**, English (LTR) via switcher. Locale persisted on `profiles.locale` + localStorage.
- Email OTP auth (no passwords), role-based redirect after login.
- Three roles: Customer, Barber, Shop Manager (+ internal Admin).
- Shop profiles + **Barber profiles as the hero surface** (Instagram-style portfolio).
- Service catalog (per shop, optionally per barber) with price (SAR) + duration.
- Discovery: search, **specialty filter chips**, distance / rating / price filters, geolocation-based distance sort.
- Booking flow (**one service per booking**): service → date → time → confirm.
- Booking management (view, cancel, reschedule).
- Reviews & ratings (**only customers with a completed booking**).
- Favorites (barbers + shops).
- Role dashboards.
- **Invite-only** onboarding for shops/barbers.

**Out (future phases):** payments, live queue, real-time availability sockets, loyalty, promotions, multi-service cart, AI, native apps, advanced analytics.

## 2. Design Direction — Black & Gold Premium

- **Palette:**
  - Background: near-black `#0B0B0D` and ink `#111114`
  - Surface: `#15151A` with subtle `#1E1E24` cards
  - Primary text: `#F5F2EA` (warm off-white)
  - Muted text: `#8A8A92`
  - **Gold accent (primary):** `#C9A24B` with glow `#E6C172`
  - Hairline border: `#2A2A30`
  - Star/rating: gold (same as accent)
- **Type:** Arabic — **IBM Plex Sans Arabic** (also pairs as a serif-lite display when needed). Latin — **Cormorant Garamond** for display headings, **Inter** for body. Tracks tight on headings, generous leading.
- **Shape & feel:** rounded `2xl`, thin 1px gold hairlines on key cards, soft inner-glow shadows, lots of black negative space, photography-led. No purple anywhere.
- **Motion:** subtle fades + 200ms ease transitions; portfolio images use a soft zoom-on-hover and tap-to-fullscreen.
- **RTL parity:** mirrored chevrons, logical Tailwind properties (`ms-/me-`), Arabic numerals option in settings (Latin digits default for prices).

## 3. Barber Profile — The Hero Page (Instagram-style)

This is the most important page in the product. Layout (mobile-first, scrollable):

1. **Cover strip** — black with gold hairline. Back / share / favorite (gold heart) on top.
2. **Identity block** — circular avatar (gold ring), name, "حلاق / Barber", shop name (linked), gold star + rating + review count, shop location + distance, "Available today" pill if applicable.
3. **Quick stats row** — Appointments completed · Clients served · Years experience.
4. **Specialty chips** — gold-outlined chips: Fade, Skin Fade, Taper Fade, French Crop, Buzz Cut, Beard Styling. Tapping a chip filters this barber's portfolio by tag.
5. **Portfolio grid (the Instagram surface)** — square 3-column masonry/grid of haircut photos. Tap → full-screen lightbox with swipe, caption, tags, "Book this look" CTA which deep-links the booking flow with that specialty preselected.
6. **Tabbed section:** About · Services · Portfolio · Reviews (sticky on scroll).
   - **About:** bio, languages spoken, specialties, working days/times.
   - **Services:** list with price + duration + Book button (single-service MVP).
   - **Reviews:** list with 5-star, customer initial, date, comment.
7. **Sticky bottom bar** — gold "Book now" button (full width on mobile).

Every portfolio photo carries `specialty_tags[]` so filtering and "browse by haircut" works cross-platform (see Search).

## 4. User Roles & Auth

- **Customer** — self-signs up via email OTP. Default role.
- **Barber** — invite-only via single-use link from manager/admin. Completes OTP, then profile + portfolio.
- **Shop Manager** — invite-only from admin. Owns one shop in MVP.
- **Admin** — internal, gated by `has_role('admin')`.

Roles live in a separate `user_roles` table with `has_role()` SECURITY DEFINER. Post-login redirect: customer → `/app`, barber → `/barber`, manager → `/manager`.

## 5. Page Hierarchy

```text
Public
  /                       Landing (Arabic by default)
  /auth                   Email OTP
  /barbers                Browse barbers (primary discovery)
  /barbers/$barberId      Barber portfolio profile (HERO PAGE)
  /shops                  Browse shops
  /shops/$shopId          Shop profile (gallery, services, team, reviews, hours)
  /search                 Unified search w/ specialty + filters
  /look/$specialtySlug    Specialty landing: e.g. /look/fade — all portfolio photos tagged Fade across the platform (Instagram-style explore)

Authenticated — /_authenticated/...
  Customer
    /app                  Home (nearby barbers, top rated, recent portfolio feed, specialty shortcuts)
    /app/bookings         Upcoming + history
    /app/bookings/$id     Detail (reschedule / cancel / review CTA when completed)
    /app/favorites        Saved barbers + shops
    /app/profile          Account, language, notifications

  /book/$barberId         Multi-step single-service booking
  /book/shop/$shopId      Shop entry → pick barber inside, then single service

  Barber
    /barber               Today + upcoming
    /barber/portfolio     Upload, tag with specialties, reorder, captions
    /barber/services      Personal service list
    /barber/availability  Weekly schedule + time-off
    /barber/reviews
    /barber/profile

  Manager
    /manager              Today KPIs
    /manager/bookings     Calendar / list
    /manager/services     CRUD + pricing
    /manager/barbers      Add/remove + invites
    /manager/shop         Profile, gallery, hours, location
    /manager/analytics    Basic
```

## 6. Specialty Filter System

Canonical specialties (seeded `specialties` table, bilingual labels):

| Slug | EN | AR |
|---|---|---|
| fade | Fade | تدرج |
| skin-fade | Skin Fade | تدرج جلدي |
| taper-fade | Taper Fade | تدرج خفيف |
| french-crop | French Crop | فرنش كروب |
| buzz-cut | Buzz Cut | قصة بوز |
| beard-styling | Beard Styling | تنسيق اللحية |

Used in three places:
1. **Barber discovery filter** — multi-select chips at top of `/barbers` and `/search`.
2. **Barber profile specialties** — gold chips shown on the profile; barber selects from this list in `/barber/profile`.
3. **Portfolio photo tags** — each portfolio photo can be tagged with 1–3 specialties; powers `/look/$specialtySlug` explore and "Book this look" deep links.

## 7. Core User Flows

**Discover → Book (primary):**
Home → tap specialty chip (e.g. Fade) → filtered barbers list sorted by distance → barber portfolio page → browse photos → tap "Book this look" or "Book now" → pick service → pick date → pick time slot → review & confirm → booking detail with map + cancellation policy.

**Explore by look:** Home → "Browse by haircut" row → /look/fade → grid of every Fade photo across platform → tap photo → barber profile.

**Review:** Booking marked `completed` → "Review" CTA appears in /app/bookings → 1–5 stars + comment → triggers update aggregate ratings.

**Barber onboarding:** Manager sends invite → barber OTP → fills profile, picks specialties → uploads portfolio with tags + captions → sets availability → goes live.

## 8. Database Schema (Lovable Cloud / Postgres)

All `public`, RLS on, explicit GRANTs.

- `profiles` (id = auth.users.id, full_name, phone, avatar_url, locale default `'ar'`, created_at)
- `user_roles` (id, user_id, role enum: customer|barber|manager|admin) + `has_role()` fn
- `shops` (id, manager_id, name_en/ar, slug, description_en/ar, cover_url, lat, lng, address, city, district, phone, status, featured, rating_avg, rating_count)
- `shop_photos` (id, shop_id, url, sort)
- `shop_hours` (id, shop_id, day_of_week 0-6, opens_at, closes_at) — multiple per day for split shifts
- `specialties` (id, slug unique, label_en, label_ar) — seeded with the 6 above
- `barbers` (id, profile_id, shop_id, display_name_en/ar, bio_en/ar, photo_url, years_experience, status, rating_avg, rating_count, appointments_completed, clients_served)
- `barber_specialties` (barber_id, specialty_id) PK composite
- `portfolio_photos` (id, barber_id, url, caption_en/ar, sort, created_at)
- `portfolio_photo_specialties` (photo_id, specialty_id) PK composite — for tag filtering / Explore
- `services` (id, shop_id, name_en/ar, description_en/ar, price_sar numeric, duration_min int, category, active)
- `barber_services` (barber_id, service_id) — which barbers perform a service (default: all)
- `barber_availability` (id, barber_id, day_of_week, starts_at, ends_at)
- `barber_time_off` (id, barber_id, starts_at tstz, ends_at tstz, reason)
- `bookings` (id, customer_id, shop_id, barber_id, service_id, starts_at tstz, ends_at tstz, price_sar, status enum, booking_ref unique, notes, created_at) — **exactly one service per booking**
- `reviews` (id, booking_id unique, customer_id, barber_id, shop_id, rating int 1-5, comment, created_at)
- `favorites` (user_id, target_type enum, target_id, created_at) composite PK
- `invites` (id, email, role, shop_id nullable, token, expires_at, used_at)

**RLS sketch:**
- Public SELECT (anon) on active shops, barbers, services, portfolio_photos + tags, specialties, shop_photos, shop_hours, barber_availability, reviews.
- Mutate shop data: `shops.manager_id = auth.uid()` or admin.
- Mutate barber portfolio/availability/profile: `barbers.profile_id = auth.uid()` OR the shop's manager.
- `bookings`: customer reads own; barber reads where their `profile_id` matches; manager reads where shop's `manager_id` matches; insert requires authenticated customer; status transitions via server fn only.
- `reviews`: insert only when `has_completed_booking(customer_id, barber_id)` (SECURITY DEFINER check) AND `booking_id` belongs to that customer.
- `favorites`, `profiles`: owner only.

**Triggers:**
- `auth.users` insert → create `profiles` row (locale `'ar'`) + default `customer` role.
- `reviews` insert/delete → recompute aggregate ratings on barbers + shops.
- Booking insert → server-side slot validation (no overlap with non-cancelled bookings, time-off; must fit availability + shop hours, in Asia/Riyadh).

## 9. Dashboards

**Customer:** Upcoming card (next booking + map + reschedule), History list with review CTA, Favorites (barbers + shops tabs), Profile/language/notifications.

**Barber:** Today timeline, Upcoming list, Reviews feed, **Portfolio uploader** (drag-drop, multi-tag with specialties, caption AR+EN, reorder), Specialties multi-select, Weekly availability + time-off, Stats (completed, clients, avg rating).

**Manager:** Today KPIs (bookings, est. revenue, utilization), Calendar (day/week) across all barbers, Services CRUD, Barbers list with invite/remove/status, Shop profile editor, Analytics (bookings over time, top services, top barbers, repeat-customer rate).

## 10. Technical Architecture

- **Stack:** TanStack Start (React 19 + Vite 7), Tailwind v4, shadcn, TanStack Query + Router.
- **Backend:** Lovable Cloud (Postgres + Auth + Storage). App logic in `createServerFn`. No edge functions for MVP.
- **i18n:** `i18next` + `react-i18next`. **Default `ar`**, fallback `en`. `<html lang dir>` toggled. Tailwind logical properties throughout.
- **Auth:** Supabase email OTP via `signInWithOtp`. After verify, look up role, redirect.
- **Storage:** buckets `shop-covers`, `shop-gallery`, `barber-portfolio`, `avatars`. Public read, scoped writes via policies.
- **Geolocation:** `navigator.geolocation` on home + search. Haversine distance client-side from `shops.lat/lng`. No map provider in MVP — address text + "Get directions" external link on booking detail.
- **Slot engine:** server fn `getAvailableSlots(barberId, dateISO, durationMin)` derives slots from availability − time-off − bookings, in `Asia/Riyadh`.
- **Booking creation:** server fn `createBooking` atomically re-validates and inserts; returns booking with generated ref (e.g. `F569ADD0`).
- **Authorization:** `requireSupabaseAuth` on all mutating fns; `has_role()` for role-gated endpoints.
- **Realtime:** Supabase subscription on `bookings` for barber/manager dashboards so today's list updates live.

## 11. Implementation Strategy (phased)

1. **Foundation** — Cloud on; schema + RLS + grants + triggers; OTP auth + role system + auth-attacher; i18n shell (Arabic default + RTL); **black & gold design system tokens**.
2. **Barber profile (hero) + portfolio grid + lightbox** — built first since it's the most important surface; seed with demo barber + portfolio.
3. **Discovery** — `/barbers` with specialty chip filters + distance sort, `/shops`, `/look/$specialtySlug` explore.
4. **Booking flow** — service → date/time (slot engine) → confirm → booking detail. Customer dashboard.
5. **Barber dashboard** — portfolio uploader with specialty tagging, availability editor, today/upcoming, reviews, profile.
6. **Manager dashboard** — shop profile, gallery, hours, services CRUD, barbers + invites, calendar, basic analytics.
7. **Reviews** — post-completion CTA, aggregate triggers, public display.
8. **Polish + seed** — Arabic copy QA, Riyadh demo data (1 shop, 4 barbers, ~20 services, ~40 portfolio photos tagged across specialties), empty states, error boundaries, OG tags per public page.

---

Approve and I'll start with **Foundation + Barber profile (hero)** so we lock the look & feel first.
