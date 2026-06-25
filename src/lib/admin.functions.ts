import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
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
  name_en: z.string().min(1).max(200),
  name_ar: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
  description_en: z.string().max(2000).nullish(),
  description_ar: z.string().max(2000).nullish(),
  phone: z.string().max(40).nullish(),
  whatsapp: z.string().max(40).nullish(),
  email: z.string().email().max(200).nullish(),
  website: z.string().max(300).nullish(),
  city: z.string().max(120).nullish(),
  district: z.string().max(120).nullish(),
  address: z.string().max(500).nullish(),
  lat: z.number().nullish(),
  lng: z.number().nullish(),
  logo_url: z.string().nullish(),
  cover_url: z.string().nullish(),
  featured: z.boolean().optional(),
  booking_enabled: z.boolean().optional(),
  walkin_enabled: z.boolean().optional(),
  accept_reviews: z.boolean().optional(),
  max_booking_window_days: z.number().int().min(1).max(365).optional(),
  booking_interval_minutes: z.number().int().min(5).max(180).optional(),
});

export const createSalon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => salonInputSchema.parse(d))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("shops")
      .insert({ ...data, status: "active" })
      .select("id, slug")
      .single();
    if (error) throw new Error(error.message);
    await audit(context.supabase, context.userId, context.claims?.email ?? null, "salon.created", "shop", row.id, { slug: row.slug, name: data.name_en });
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
      context.supabase.from("barbers").select("id, display_name_en, display_name_ar, avatar_url, status").eq("shop_id", data.id),
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
      .select("id, display_name_en, display_name_ar, avatar_url, status, rating_avg, rating_count, shop_id, created_at, shops:shop_id(name_en, name_ar)")
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
    const { error } = await context.supabase.from("platform_settings").update(patch).eq("id", 1);
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
