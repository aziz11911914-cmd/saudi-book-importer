## Super Admin Platform — Implementation Plan

### 1. What already exists

**Auth & roles**
- Email OTP authentication (`auth-otp.functions.ts`, `auth.tsx`) — keep as-is.
- `profiles` table, `user_roles` table, `app_role` enum, `has_role()` SECURITY DEFINER function.
- `AuthProvider` exposes `roles`.
- Existing enum values: `customer`, `barber`, `manager`, `admin`.

**Domain tables**
- `shops` (with `manager_id`, `status`, `featured`, ratings, location).
- `barbers`, `barber_services`, `barber_availability`, `barber_time_off`, `barber_specialties`.
- `services`, `shop_hours`, `shop_photos`.
- `bookings` (with `booking_ref`, status enum, customer/shop/barber/service).
- `reviews`, `favorites`, `portfolio_photos`, `portfolio_photo_specialties`, `specialties`.
- `invites` table (email/role/shop_id/token/expires_at) — partially built.

**Customer app routes** (`/`, `/search`, `/shops/$slug`, `/barbers/...`, `/book/...`, `/bookings/...`, `/favorites`, `/auth`, `/_authenticated/profile|settings`).

### 2. What is missing

**Database**
- `app_role` enum has `admin`/`manager`; spec uses `super_admin`/`owner`. Need to decide: rename vs. alias.
- No `audit_logs` table.
- No `notifications` table (in-app + email log only).
- No `platform_settings` table (general / booking / auth / notifications / maintenance).
- `profiles` missing `status` (active/suspended), `last_login_at`, `nationality`, `language`, `notes`.
- `shops` missing `whatsapp`, `website`, `email`, `booking_enabled`, `walkin_enabled`, `accept_reviews`, `max_booking_window`, `booking_interval`, `logo_url`.
- `bookings` missing `no_show_at` / grace-period handling at DB level.
- No DB trigger to seed the initial super admin (`abdulazizalodan1@gmail.com`).

**Backend (server functions)**
- Admin-scoped server fns (list/create/update/suspend salons, owners, barbers, customers, bookings, reviews).
- Owner-scoped server fns (own salon only).
- Barber-scoped server fns (self only).
- Invitation send/accept tied to OTP login.
- Audit logging middleware/helper.
- Dashboard metrics aggregation fn.
- Global admin search fn.

**Frontend routes & layouts**
- `/admin/*` Super Admin shell (sidebar, topbar, global search, +Create menu).
- `/owner/*` Owner shell (own salon only).
- `/barber/*` Barber shell (self only).
- `/access-denied` page.
- Post-login role-based redirect.
- All admin pages: Dashboard, Salons (list/detail/create/edit), Owners, Barbers, Customers, Bookings, Reviews, Reports, Notifications, Settings, Audit Logs, Profile.

### 3. Implementation order

1. **DB migration #1 — roles & profile fields**: extend `app_role` enum with `super_admin`, `owner` (keep old values as aliases via mapping), add `status`/`last_login_at`/`nationality`/`language`/`notes` on profiles, seed initial super admin role on signup trigger for `abdulazizalodan1@gmail.com`.
2. **DB migration #2 — admin tables**: `audit_logs`, `notifications`, `platform_settings` (singleton row), missing `shops` columns. Full GRANTs + RLS using `has_role(auth.uid(),'super_admin')`.
3. **Server functions**: `admin.functions.ts` (metrics, salons, owners, barbers, customers, bookings, reviews, settings, audit, search), `owner.functions.ts`, `barber.functions.ts`, `invites.functions.ts`. All gated by `requireSupabaseAuth` + role check; every write emits an audit log.
4. **Shared admin UI**: `AdminLayout` (sidebar + topbar + global search + Create menu), `DataTable`, `StatCard`, `ConfirmDialog`, `AccessDenied`.
5. **Routes — `_authenticated/admin/*`**: dashboard, salons (index/$id/new), owners, barbers, customers, bookings, reviews, reports, notifications, settings, audit-logs. Each route's loader calls a `requireSupabaseAuth`+super_admin server fn.
6. **Routes — `_authenticated/owner/*`** and **`_authenticated/barber/*`** shells with own-scope queries.
7. **Post-login redirect**: update `/auth` success handler → route by highest role (super_admin → `/admin`, owner → `/owner`, barber → `/barber`, else `/`).
8. **Invitation flow**: Super Admin creates Owner/Barber → `invites` row + invitation email with magic link to `/auth?email=…` → existing OTP completes login → on first sign-in, link profile to role+shop from invite token.
9. **i18n**: add AR/EN strings for all new admin surfaces.
10. **Verification**: Playwright smoke test of super admin login, create salon→owner→barber, owner login sees only own salon, barber login sees only self, customer login unchanged.

### 4. Open questions before I start

1. **Role enum naming.** Existing DB uses `admin` and `manager`. Spec uses `super_admin` and `owner`. Three options:
   (a) Add `super_admin` + `owner` to the enum and migrate existing rows (cleanest, matches spec).
   (b) Keep `admin`/`manager` and treat them as aliases in app code.
   (c) Add the new values and keep the old as deprecated synonyms during transition.
   I recommend (a). Confirm?
2. **Initial super admin.** Auto-grant `super_admin` to `abdulazizalodan1@gmail.com` once (in the signup trigger) and never again, so the email is not hardcoded for runtime permission checks — OK?
3. **Owner & Barber dashboards.** Spec says post-login owners go to `/owner` and barbers to `/barber`. Should I build full Owner/Barber dashboards now, or only the shell + access guard in this round and focus depth on Super Admin (which is what the spec title emphasizes)?
4. **Notifications channel.** Build in-app notifications table + email via existing Lovable email queue? Push is explicitly future.
5. **Audit log scope.** Log every admin write (create/update/suspend/delete on salons/owners/barbers/customers/reviews/settings) — confirm that's the desired granularity (no read logging)?

Once you answer these, I'll execute steps 1→10 in order. The first user-visible deliverable will be the Super Admin shell + Dashboard + Salons module, then Owners/Barbers/Customers/Bookings, then Reviews/Reports/Settings/Audit Logs.