import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- helpers ----------
async function assertSuperAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((r: any) => r.role);
  if (!roles.includes("super_admin")) {
    throw new Response("Forbidden", { status: 403 });
  }
}

async function audit(
  supabase: any,
  actorId: string,
  actorEmail: string | null,
  action: string,
  targetType?: string,
  targetId?: string,
  details: Record<string, unknown> = {},
) {
  await supabase.from("audit_logs").insert({
    actor_id: actorId,
    actor_email: actorEmail,
    action,
    target_type: targetType ?? null,
    target_id: targetId ?? null,
    details,
  });
}

// ---------- dashboard metrics ----------
export const getAdminMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const sb = context.supabase;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [
      shops,
      owners,
      barbers,
      customers,
      bookingsTotal,
      bookingsToday,
      bookingsPending,
      bookingsCompleted,
      bookingsCancelled,
      newUsersWeek,
      reviewsAgg,
      recentReviews,
      recentActivity,
    ] = await Promise.all([
      sb.from("shops").select("id, status", { count: "exact", head: false }),
      sb.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "owner"),
      sb.from("barbers").select("id", { count: "exact", head: true }),
      sb.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "customer"),
      sb.from("bookings").select("id", { count: "exact", head: true }),
      sb.from("bookings").select("id", { count: "exact", head: true }).gte("starts_at", today.toISOString()),
      sb.from("bookings").select("id", { count: "exact", head: true }).eq("status", "pending"),
      sb.from("bookings").select("id", { count: "exact", head: true }).eq("status", "completed"),
      sb.from("bookings").select("id", { count: "exact", head: true }).eq("status", "cancelled"),
      sb.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", weekAgo.toISOString()),
      sb.from("reviews").select("rating"),
      sb.from("reviews").select("id, rating, comment, created_at, customer_id, shop_id").order("created_at", { ascending: false }).limit(5),
      sb.from("audit_logs").select("id, action, target_type, target_id, actor_email, created_at, details").order("created_at", { ascending: false }).limit(20),
    ]);

    const shopsCount = shops.count ?? (shops.data?.length ?? 0);
    const activeShops = (shops.data ?? []).filter((s: any) => s.status === "active").length;
    const ratings = (reviewsAgg.data ?? []).map((r: any) => Number(r.rating)).filter(Boolean);
    const avgRating = ratings.length ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length : 0;

    return {
      totals: {
        salons: shopsCount,
        activeSalons: activeShops,
        owners: owners.count ?? 0,
        barbers: barbers.count ?? 0,
        customers: customers.count ?? 0,
        bookings: bookingsTotal.count ?? 0,
        bookingsToday: bookingsToday.count ?? 0,
        bookingsPending: bookingsPending.count ?? 0,
        bookingsCompleted: bookingsCompleted.count ?? 0,
        bookingsCancelled: bookingsCancelled.count ?? 0,
        newUsersThisWeek: newUsersWeek.count ?? 0,
        averageRating: Number(avgRating.toFixed(2)),
      },
      recentReviews: recentReviews.data ?? [],
      recentActivity: recentActivity.data ?? [],
    };
  });

// ---------- salons ----------
export const listSalons = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { search?: string; status?: string } | undefined) => d ?? {})
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    let q = context.supabase
      .from("shops")
      .select("id, slug, name_en, name_ar, city, status, featured, rating_avg, rating_count, manager_id, logo_url, cover_url, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.search) q = q.or(`name_en.ilike.%${data.search}%,name_ar.ilike.%${data.search}%,city.ilike.%${data.search}%`);
    if (data.status) q = q.eq("status", data.status as any);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const salonInputSchema = z.object({
  name_ar: z.string().trim().min(1).max(200),
  name_en: z.string().trim().max(200).optional().default(""),
  city: z.string().trim().max(120).optional().nullable(),
  district: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().email().max(200).optional().nullable().or(z.literal("").transform(() => null)),
  logo_url: z.string().trim().max(500).optional().nullable(),
});

export const createSalon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => salonInputSchema.parse(d))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const nameEn = (data.name_en && data.name_en.length > 0) ? data.name_en : data.name_ar;
    const slugSource = (data.name_en && data.name_en.length > 0) ? data.name_en : data.name_ar;
    const { data: slugRow, error: slugErr } = await context.supabase
      .rpc("generate_unique_shop_slug", { _base: slugSource });
    if (slugErr) throw new Error(slugErr.message);
    const slug: string = slugRow as any;
    const { data: row, error } = await context.supabase
      .from("shops")
      .insert({
        name_ar: data.name_ar,
        name_en: nameEn,
        slug,
        city: data.city || null,
        district: data.district || null,
        phone: data.phone || null,
        email: data.email || null,
        logo_url: data.logo_url || null,
        status: "active",
      } as any)
      .select("id, slug")
      .single();
    if (error) throw new Error(error.message);
    await audit(context.supabase, context.userId, context.claims?.email ?? null, "salon.created", "shop", row.id, { slug: row.slug, name: nameEn });
    return row;
  });

export const updateSalon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; patch: Record<string, unknown> }) => d)
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("shops").update(data.patch as any).eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(context.supabase, context.userId, context.claims?.email ?? null, "salon.updated", "shop", data.id, data.patch);
    return { ok: true };
  });

export const setSalonStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: "active" | "inactive" | "draft" | "suspended" }) => d)
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("shops").update({ status: data.status as any }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(context.supabase, context.userId, context.claims?.email ?? null, `salon.${data.status}`, "shop", data.id);
    return { ok: true };
  });

export const deleteSalon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("shops").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(context.supabase, context.userId, context.claims?.email ?? null, "salon.deleted", "shop", data.id);
    return { ok: true };
  });

export const getSalon = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const [shop, barbers, bookings, reviews, hours] = await Promise.all([
      context.supabase.from("shops").select("*").eq("id", data.id).maybeSingle(),
      context.supabase.from("barbers").select("id, display_name_en, display_name_ar, photo_url, status").eq("shop_id", data.id),
      context.supabase.from("bookings").select("id, booking_ref, status, starts_at, price_sar").eq("shop_id", data.id).order("starts_at", { ascending: false }).limit(20),
      context.supabase.from("reviews").select("id, rating, comment, created_at").eq("shop_id", data.id).order("created_at", { ascending: false }).limit(10),
      context.supabase.from("shop_hours").select("*").eq("shop_id", data.id),
    ]);
    if (shop.error) throw new Error(shop.error.message);
    return { shop: shop.data, barbers: barbers.data ?? [], bookings: bookings.data ?? [], reviews: reviews.data ?? [], hours: hours.data ?? [] };
  });

// ---------- owners ----------
export const listOwners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { search?: string } | undefined) => d ?? {})
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { data: roleRows, error } = await context.supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "owner");
    if (error) throw new Error(error.message);
    const ids = (roleRows ?? []).map((r: any) => r.user_id);
    if (ids.length === 0) return [];
    let pQ = context.supabase
      .from("profiles")
      .select("id, email, full_name, first_name, last_name, phone, status, last_login_at, created_at")
      .in("id", ids);
    if (data.search) pQ = pQ.or(`email.ilike.%${data.search}%,full_name.ilike.%${data.search}%,phone.ilike.%${data.search}%`);
    const { data: profiles, error: pErr } = await pQ;
    if (pErr) throw new Error(pErr.message);
    const { data: shops } = await context.supabase
      .from("shops")
      .select("id, name_en, name_ar, manager_id")
      .in("manager_id", ids);
    const shopByOwner = new Map<string, any>();
    (shops ?? []).forEach((s: any) => shopByOwner.set(s.manager_id, s));
    return (profiles ?? []).map((p: any) => ({ ...p, shop: shopByOwner.get(p.id) ?? null }));
  });

// ---------- barbers ----------
export const listBarbers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { search?: string; shopId?: string } | undefined) => d ?? {})
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    let q = context.supabase
      .from("barbers")
      .select("id, display_name_en, display_name_ar, photo_url, status, rating_avg, rating_count, shop_id, created_at, shops:shop_id(name_en, name_ar)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.search) q = q.or(`display_name_en.ilike.%${data.search}%,display_name_ar.ilike.%${data.search}%`);
    if (data.shopId) q = q.eq("shop_id", data.shopId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ---------- customers ----------
export const listCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { search?: string } | undefined) => d ?? {})
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { data: roleRows } = await context.supabase
      .from("user_roles").select("user_id").eq("role", "customer");
    const ids = (roleRows ?? []).map((r: any) => r.user_id);
    if (ids.length === 0) return [];
    let q = context.supabase
      .from("profiles")
      .select("id, email, full_name, phone, status, last_login_at, created_at")
      .in("id", ids)
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.search) q = q.or(`email.ilike.%${data.search}%,full_name.ilike.%${data.search}%,phone.ilike.%${data.search}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const setProfileStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: "active" | "suspended" }) => d)
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("profiles").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(context.supabase, context.userId, context.claims?.email ?? null, `profile.${data.status}`, "profile", data.id);
    return { ok: true };
  });

// ---------- bookings ----------
export const listAllBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string; shopId?: string } | undefined) => d ?? {})
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    let q = context.supabase
      .from("bookings")
      .select("id, booking_ref, status, starts_at, ends_at, price_sar, shop_id, barber_id, customer_id, service_id, shops:shop_id(name_en, name_ar), barbers:barber_id(display_name_en, display_name_ar), services:service_id(name_en, name_ar)")
      .order("starts_at", { ascending: false })
      .limit(300);
    if (data.status) q = q.eq("status", data.status as any);
    if (data.shopId) q = q.eq("shop_id", data.shopId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ---------- reviews ----------
export const listAllReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("reviews")
      .select("id, rating, comment, created_at, shop_id, barber_id, customer_id, shops:shop_id(name_en, name_ar), barbers:barber_id(display_name_en, display_name_ar)")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const deleteReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("reviews").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(context.supabase, context.userId, context.claims?.email ?? null, "review.deleted", "review", data.id);
    return { ok: true };
  });

// ---------- audit logs ----------
export const listAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("audit_logs")
      .select("id, action, actor_email, target_type, target_id, details, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ---------- platform settings ----------
export const getSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("platform_settings").select("*").eq("id", 1).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const updateSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { section: "general" | "booking" | "authentication" | "notifications" | "maintenance"; values: Record<string, unknown> }) => d)
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const patch: Record<string, unknown> = {};
    patch[data.section] = data.values;
    patch.updated_by = context.userId;
    const { error } = await context.supabase.from("platform_settings").update(patch as any).eq("id", 1);
    if (error) throw new Error(error.message);
    await audit(context.supabase, context.userId, context.claims?.email ?? null, "settings.updated", "platform_settings", "1", { section: data.section });
    return { ok: true };
  });

// ---------- global search ----------
export const adminGlobalSearch = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { q: string }) => d)
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const term = `%${data.q}%`;
    const [shops, barbers, profiles, bookings] = await Promise.all([
      context.supabase.from("shops").select("id, slug, name_en, name_ar, city").or(`name_en.ilike.${term},name_ar.ilike.${term},city.ilike.${term}`).limit(10),
      context.supabase.from("barbers").select("id, display_name_en, display_name_ar, shop_id").or(`display_name_en.ilike.${term},display_name_ar.ilike.${term}`).limit(10),
      context.supabase.from("profiles").select("id, email, full_name, phone").or(`email.ilike.${term},full_name.ilike.${term},phone.ilike.${term}`).limit(10),
      context.supabase.from("bookings").select("id, booking_ref, status").ilike("booking_ref", term).limit(10),
    ]);
    return {
      salons: shops.data ?? [],
      barbers: barbers.data ?? [],
      users: profiles.data ?? [],
      bookings: bookings.data ?? [],
    };
  });

// ---------- notifications ----------
export const broadcastNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { title: string; body?: string; audience: "all" | "owners" | "barbers" | "customers" }) => d)
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    let userIds: string[] = [];
    if (data.audience === "all") {
      const { data: rows } = await context.supabase.from("profiles").select("id");
      userIds = (rows ?? []).map((r: any) => r.id);
    } else {
      const roleMap = { owners: "owner", barbers: "barber", customers: "customer" } as const;
      const { data: rows } = await context.supabase
        .from("user_roles").select("user_id").eq("role", roleMap[data.audience]);
      userIds = (rows ?? []).map((r: any) => r.user_id);
    }
    if (userIds.length === 0) return { sent: 0 };
    const payload = userIds.map((uid) => ({
      user_id: uid,
      kind: "announcement",
      title: data.title,
      body: data.body ?? null,
    }));
    // chunk inserts of 500
    for (let i = 0; i < payload.length; i += 500) {
      const slice = payload.slice(i, i + 500);
      const { error } = await context.supabase.from("notifications").insert(slice);
      if (error) throw new Error(error.message);
    }
    await audit(context.supabase, context.userId, context.claims?.email ?? null, "notification.broadcast", "audience", data.audience, { title: data.title, recipients: userIds.length });
    return { sent: userIds.length };
  });

export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("notifications")
      .select("id, title, body, kind, read_at, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ---------- invitations ----------
const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  role: z.enum(["owner", "barber"]),
  shop_id: z.string().uuid().nullable().optional(),
  full_name: z.string().max(200).optional(),
  phone: z.string().max(40).optional(),
  nationality: z.string().max(80).optional(),
  language: z.string().max(8).optional(),
  notes: z.string().max(2000).optional(),
  expires_in_hours: z.number().int().min(1).max(720).optional(),
});

function randomToken() {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export const createInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inviteSchema.parse(d))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const expires = new Date(Date.now() + (data.expires_in_hours ?? 168) * 3600_000).toISOString();
    const token = randomToken();
    const { data: row, error } = await context.supabase
      .from("invites")
      .insert({
        email: data.email,
        role: data.role,
        shop_id: data.shop_id ?? null,
        token,
        expires_at: expires,
        invited_by: context.userId,
      })
      .select("id, email, role, shop_id, token, expires_at")
      .single();
    if (error) throw new Error(error.message);

    // Best-effort: pre-create profile fields for the invited email if a profile already exists
    if (data.full_name || data.phone || data.nationality || data.language || data.notes) {
      const { data: existing } = await context.supabase
        .from("profiles").select("id").eq("email", data.email).maybeSingle();
      if (existing) {
        await context.supabase.from("profiles").update({
          full_name: data.full_name ?? undefined,
          phone: data.phone ?? undefined,
          nationality: data.nationality ?? undefined,
          language: data.language ?? undefined,
          notes: data.notes ?? undefined,
        }).eq("id", existing.id);
      }
    }

    await audit(context.supabase, context.userId, context.claims?.email ?? null,
      `invite.${data.role}.created`, "invite", row.id, { email: data.email, shop_id: data.shop_id ?? null });
    return row;
  });

export const listInvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { role?: "owner" | "barber" } | undefined) => d ?? {})
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    let q = context.supabase
      .from("invites")
      .select("id, email, role, shop_id, used_at, expires_at, created_at, token")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.role) q = q.eq("role", data.role);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const revokeInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("invites")
      .update({ used_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(context.supabase, context.userId, context.claims?.email ?? null, "invite.revoked", "invite", data.id);
    return { ok: true };
  });

// ---------- profile/owner/barber/customer detail ----------
export const getProfileDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const [profile, roles, bookings, reviews, favorites, shop, barberRow] = await Promise.all([
      context.supabase.from("profiles").select("*").eq("id", data.id).maybeSingle(),
      context.supabase.from("user_roles").select("role").eq("user_id", data.id),
      context.supabase.from("bookings").select("id, booking_ref, status, starts_at, price_sar, shop_id, shops:shop_id(name_en)").eq("customer_id", data.id).order("starts_at", { ascending: false }).limit(50),
      context.supabase.from("reviews").select("id, rating, comment, created_at, hidden_at, shop_id, shops:shop_id(name_en)").eq("customer_id", data.id).order("created_at", { ascending: false }).limit(50),
      context.supabase.from("favorites").select("id, shop_id, barber_id, created_at").eq("user_id", data.id),
      context.supabase.from("shops").select("id, name_en, name_ar, slug, status").eq("manager_id", data.id).maybeSingle(),
      context.supabase.from("barbers").select("id, display_name_en, shop_id, status, shops:shop_id(name_en)").eq("profile_id", data.id).maybeSingle(),
    ]);
    if (profile.error) throw new Error(profile.error.message);
    return {
      profile: profile.data,
      roles: (roles.data ?? []).map((r: any) => r.role),
      bookings: bookings.data ?? [],
      reviews: reviews.data ?? [],
      favorites: favorites.data ?? [],
      ownerShop: shop.data ?? null,
      barber: barberRow.data ?? null,
    };
  });

export const getBarberDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const [barber, services, portfolio, bookings, reviews] = await Promise.all([
      context.supabase.from("barbers").select("*, shops:shop_id(id, name_en, name_ar, slug)").eq("id", data.id).maybeSingle(),
      context.supabase.from("barber_services").select("service_id, services:service_id(id, name_en, price_sar, duration_minutes, active)").eq("barber_id", data.id),
      context.supabase.from("portfolio_photos").select("id, url, title_en, title_ar, caption_en, caption_ar, display_order, status").eq("barber_id", data.id).order("display_order", { ascending: true }).limit(50),
      context.supabase.from("bookings").select("id, booking_ref, status, starts_at, price_sar").eq("barber_id", data.id).order("starts_at", { ascending: false }).limit(30),
      context.supabase.from("reviews").select("id, rating, comment, created_at").eq("barber_id", data.id).order("created_at", { ascending: false }).limit(30),
    ]);
    if (barber.error) throw new Error(barber.error.message);
    return { barber: barber.data, services: services.data ?? [], portfolio: portfolio.data ?? [], bookings: bookings.data ?? [], reviews: reviews.data ?? [] };
  });

export const updateBarber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; patch: Record<string, unknown> }) => d)
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("barbers").update(data.patch as any).eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(context.supabase, context.userId, context.claims?.email ?? null, "barber.updated", "barber", data.id, data.patch);
    return { ok: true };
  });

// ---------- booking actions ----------
const bookingStatusSchema = z.enum(["pending", "confirmed", "completed", "cancelled", "no_show", "rejected"]);

export const updateBookingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: z.infer<typeof bookingStatusSchema>; reason?: string }) => ({
    id: d.id, status: bookingStatusSchema.parse(d.status), reason: d.reason,
  }))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const patch: any = { status: data.status };
    if (data.status === "cancelled") {
      patch.cancelled_at = new Date().toISOString();
      patch.cancelled_by = context.userId;
      if (data.reason) patch.cancel_reason = data.reason;
    }
    const { error } = await context.supabase.from("bookings").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(context.supabase, context.userId, context.claims?.email ?? null, `booking.${data.status}`, "booking", data.id, { reason: data.reason ?? null });
    return { ok: true };
  });

// ---------- review moderation ----------
export const setReviewHidden = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; hidden: boolean }) => d)
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const patch: any = data.hidden
      ? { hidden_at: new Date().toISOString(), hidden_by: context.userId }
      : { hidden_at: null, hidden_by: null };
    const { error } = await context.supabase.from("reviews").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(context.supabase, context.userId, context.claims?.email ?? null, data.hidden ? "review.hidden" : "review.restored", "review", data.id);
    return { ok: true };
  });

// ---------- extended reports ----------
export const getReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const sb = context.supabase;
    const now = new Date();
    const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(startOfDay); startOfWeek.setDate(startOfWeek.getDate() - 7);
    const startOfMonth = new Date(startOfDay); startOfMonth.setDate(1);

    const [bookingsThisWeek, bookingsThisMonth, bookingsNoShow, popular, customers30, customers60] = await Promise.all([
      sb.from("bookings").select("id", { count: "exact", head: true }).gte("starts_at", startOfWeek.toISOString()),
      sb.from("bookings").select("id", { count: "exact", head: true }).gte("starts_at", startOfMonth.toISOString()),
      sb.from("bookings").select("id", { count: "exact", head: true }).eq("status", "no_show"),
      sb.from("bookings").select("shop_id, barber_id, service_id"),
      sb.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", new Date(now.getTime() - 30 * 86400_000).toISOString()),
      sb.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", new Date(now.getTime() - 60 * 86400_000).toISOString()).lt("created_at", new Date(now.getTime() - 30 * 86400_000).toISOString()),
    ]);

    const tally = (rows: any[], key: string) => {
      const m = new Map<string, number>();
      for (const r of rows) { const v = r?.[key]; if (!v) continue; m.set(v, (m.get(v) ?? 0) + 1); }
      return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    };
    const popRows = popular.data ?? [];
    const topShops = tally(popRows, "shop_id");
    const topBarbers = tally(popRows, "barber_id");
    const topServices = tally(popRows, "service_id");

    const lookupOne = async (table: string, ids: string[], cols: string) => {
      if (!ids.length) return [] as any[];
      const { data } = await (sb as any).from(table).select(cols).in("id", ids);
      return (data ?? []) as any[];
    };
    const [shops, barbers, services] = await Promise.all([
      lookupOne("shops", topShops.map(([id]) => id), "id, name_en, name_ar"),
      lookupOne("barbers", topBarbers.map(([id]) => id), "id, display_name_en, display_name_ar"),
      lookupOne("services", topServices.map(([id]) => id), "id, name_en, name_ar"),
    ]);
    const enrich = (top: [string, number][], rows: any[], label: string) =>
      top.map(([id, count]) => ({ id, count, label: (rows.find((r: any) => r.id === id) as any)?.[label] ?? id }));

    const newCustomersCurrent = customers30.count ?? 0;
    const newCustomersPrev = customers60.count ?? 0;
    const growthRate = newCustomersPrev > 0 ? ((newCustomersCurrent - newCustomersPrev) / newCustomersPrev) * 100 : null;

    return {
      bookingsThisWeek: bookingsThisWeek.count ?? 0,
      bookingsThisMonth: bookingsThisMonth.count ?? 0,
      bookingsNoShow: bookingsNoShow.count ?? 0,
      newCustomers30d: newCustomersCurrent,
      growthRatePct: growthRate,
      topShops: enrich(topShops, shops as any[], "name_en"),
      topBarbers: enrich(topBarbers, barbers as any[], "display_name_en"),
      topServices: enrich(topServices, services as any[], "name_en"),
    };
  });

export const consumeMyInvites = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("consume_invites_for_current_user");
    if (error) throw new Error(error.message);
    return { applied: data ?? 0 };
  });


// ---------- public invite lookup & acceptance ----------
import { createClient } from "@supabase/supabase-js";

export const getInviteByToken = createServerFn({ method: "GET" })
  .inputValidator((d: { token: string }) => d)
  .handler(async ({ data }) => {
    const sb = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { data: rows, error } = await sb.rpc("get_invite_by_token", { _token: data.token });
    if (error) throw new Error(error.message);
    const row = Array.isArray(rows) ? rows[0] : rows;
    return row ?? null;
  });

export const acceptInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { token: string }) => d)
  .handler(async ({ context, data }) => {
    const { data: result, error } = await context.supabase.rpc("accept_invite", { _token: data.token });
    if (error) throw new Error(error.message);
    return result as { ok: boolean; error?: string; role?: string; shop_id?: string; expected?: string };
  });
