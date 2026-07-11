import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SHOP_COLUMNS =
  "id, slug, manager_id, name_en, name_ar, description_en, description_ar, phone, whatsapp, email, website, instagram, snapchat, tiktok, country, city, district, address, full_address, google_maps_url, lat, lng, logo_url, cover_url, status, featured, rating_avg, rating_count, booking_enabled, walkin_enabled, accept_reviews, max_booking_window_days, booking_interval_minutes, published, paused_bookings, archived_at, display_phone, display_whatsapp, display_address, display_gallery, display_team, display_services, deletion_requested_at, deletion_requested_by, created_at, updated_at";

async function loadOwnerShop(sb: any, userId: string) {
  const { data, error } = await sb
    .from("shops")
    .select(SHOP_COLUMNS)
    .eq("manager_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Response("No salon assigned", { status: 404 });
  return data;
}

// ------------ READ ------------
export const getOwnerSalon = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const shop = await loadOwnerShop(sb, context.userId);
    const [hoursRes, photosRes, holidaysRes] = await Promise.all([
      sb.from("shop_hours").select("*").eq("shop_id", shop.id).order("day_of_week"),
      sb.from("shop_photos").select("*").eq("shop_id", shop.id).order("sort"),
      sb
        .from("shop_holidays")
        .select("*")
        .eq("shop_id", shop.id)
        .order("starts_on", { ascending: false }),
    ]);
    return {
      shop,
      hours: hoursRes.data ?? [],
      photos: photosRes.data ?? [],
      holidays: holidaysRes.data ?? [],
    };
  });

// ------------ PUBLIC PAGE (aggregated) ------------
export const getOwnerPublicPage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const shop = await loadOwnerShop(sb, context.userId);
    const [hoursRes, photosRes, servicesRes, barbersRes, reviewsRes] =
      await Promise.all([
        sb.from("shop_hours").select("*").eq("shop_id", shop.id).order("day_of_week"),
        sb.from("shop_photos").select("*").eq("shop_id", shop.id).order("sort"),
        sb
          .from("services")
          .select("id, name_en, name_ar, price_sar, duration_min, image_url, status, display_order")
          .eq("shop_id", shop.id)
          .neq("status", "archived")
          .order("display_order"),
        sb
          .from("barbers")
          .select("id, display_name_en, display_name_ar, title_en, title_ar, photo_url, status, rating_avg, featured")
          .eq("shop_id", shop.id)
          .eq("status", "active")
          .order("featured", { ascending: false })
          .order("display_name_en"),
        sb
          .from("reviews")
          .select("id, rating, comment, created_at, hidden_at, customer_id, profiles:customer_id(full_name)")
          .eq("shop_id", shop.id)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
    return {
      shop,
      hours: hoursRes.data ?? [],
      photos: photosRes.data ?? [],
      services: servicesRes.data ?? [],
      barbers: barbersRes.data ?? [],
      reviews: reviewsRes.data ?? [],
    };
  });

export const toggleReviewHidden = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; hidden: boolean }) =>
    z.object({ id: z.string().uuid(), hidden: z.boolean() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const shop = await loadOwnerShop(sb, context.userId);
    const { error } = await sb
      .from("reviews")
      .update({ hidden_at: data.hidden ? new Date().toISOString() : null })
      .eq("id", data.id)
      .eq("shop_id", shop.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ------------ UPDATE GENERAL ------------
const updateShopSchema = z
  .object({
    name_en: z.string().min(2).max(120).optional(),
    name_ar: z.string().min(2).max(120).optional(),
    description_en: z.string().max(2000).optional().nullable(),
    description_ar: z.string().max(2000).optional().nullable(),
    phone: z.string().min(6).max(32).optional().nullable(),
    whatsapp: z.string().max(32).optional().nullable(),
    email: z.string().email().optional().nullable(),
    website: z.string().url().optional().nullable().or(z.literal("")),
    instagram: z.string().max(64).optional().nullable(),
    snapchat: z.string().max(64).optional().nullable(),
    tiktok: z.string().max(64).optional().nullable(),
    country: z.string().max(64).optional().nullable(),
    city: z.string().max(120).optional().nullable(),
    district: z.string().max(120).optional().nullable(),
    address: z.string().max(500).optional().nullable(),
    full_address: z.string().max(500).optional().nullable(),
    google_maps_url: z.string().url().optional().nullable().or(z.literal("")),
    lat: z.number().min(-90).max(90).optional().nullable(),
    lng: z.number().min(-180).max(180).optional().nullable(),
    logo_url: z.string().url().optional().nullable(),
    cover_url: z.string().url().optional().nullable(),
    booking_enabled: z.boolean().optional(),
    walkin_enabled: z.boolean().optional(),
    accept_reviews: z.boolean().optional(),
    display_phone: z.boolean().optional(),
    display_whatsapp: z.boolean().optional(),
    display_address: z.boolean().optional(),
    display_gallery: z.boolean().optional(),
    display_team: z.boolean().optional(),
    display_services: z.boolean().optional(),
    published: z.boolean().optional(),
    paused_bookings: z.boolean().optional(),
    max_booking_window_days: z.number().int().min(1).max(365).optional(),
    booking_interval_minutes: z.number().int().min(5).max(120).optional(),
  })
  .strict();

export const updateOwnerSalon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateShopSchema.parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const shop = await loadOwnerShop(sb, context.userId);
    const patch: Record<string, unknown> = { ...data };
    // normalize empty strings to null
    for (const k of Object.keys(patch)) {
      if (patch[k] === "") patch[k] = null;
    }
    const { data: updated, error } = await sb
      .from("shops")
      .update(patch as never)
      .eq("id", shop.id)
      .select(SHOP_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    await sb.from("audit_logs").insert({
      actor_id: context.userId,
      action: "shop.updated",
      target_type: "shop",
      target_id: shop.id,
      details: { fields: Object.keys(data) },
    });
    return updated;
  });

// ------------ SHOP HOURS ------------
const hoursSchema = z.object({
  hours: z
    .array(
      z.object({
        day_of_week: z.number().int().min(0).max(6),
        opens_at: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable(),
        closes_at: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable(),
        closed: z.boolean().default(false),
      }),
    )
    .min(7)
    .max(7),
});

export const updateShopHours = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => hoursSchema.parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const shop = await loadOwnerShop(sb, context.userId);
    await sb.from("shop_hours").delete().eq("shop_id", shop.id);
    const rows = data.hours
      .filter((h) => !h.closed && h.opens_at && h.closes_at)
      .map((h) => ({
        shop_id: shop.id,
        day_of_week: h.day_of_week,
        opens_at: h.opens_at,
        closes_at: h.closes_at,
      }));
    if (rows.length) {
      const { error } = await sb.from("shop_hours").insert(rows as never);
      if (error) throw new Error(error.message);
    }
    await sb.from("audit_logs").insert({
      actor_id: context.userId,
      action: "shop.hours.updated",
      target_type: "shop",
      target_id: shop.id,
      details: { days: rows.length },
    });
    return { ok: true };
  });

// ------------ HOLIDAYS ------------
const holidaySchema = z.object({
  id: z.string().uuid().optional(),
  starts_on: z.string(),
  ends_on: z.string(),
  kind: z.enum(["vacation", "holiday", "temporary", "emergency"]),
  reason: z.string().max(500).optional().nullable(),
});

export const upsertHoliday = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => holidaySchema.parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const shop = await loadOwnerShop(sb, context.userId);
    if (data.id) {
      const { error } = await sb
        .from("shop_holidays")
        .update({
          starts_on: data.starts_on,
          ends_on: data.ends_on,
          kind: data.kind,
          reason: data.reason ?? null,
        })
        .eq("id", data.id)
        .eq("shop_id", shop.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await sb.from("shop_holidays").insert({
        shop_id: shop.id,
        starts_on: data.starts_on,
        ends_on: data.ends_on,
        kind: data.kind,
        reason: data.reason ?? null,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteHoliday = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const shop = await loadOwnerShop(sb, context.userId);
    const { error } = await sb
      .from("shop_holidays")
      .delete()
      .eq("id", data.id)
      .eq("shop_id", shop.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ------------ GALLERY ------------
export const addGalleryPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { url: string }) =>
    z.object({ url: z.string().url() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const shop = await loadOwnerShop(sb, context.userId);
    const { data: row, error: cntErr } = await sb
      .from("shop_photos")
      .select("sort")
      .eq("shop_id", shop.id)
      .order("sort", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (cntErr) throw new Error(cntErr.message);
    const nextSort = (row?.sort ?? -1) + 1;
    const { data: inserted, error } = await sb
      .from("shop_photos")
      .insert({ shop_id: shop.id, url: data.url, sort: nextSort })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return inserted;
  });

export const deleteGalleryPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const shop = await loadOwnerShop(sb, context.userId);
    const { data: photo } = await sb
      .from("shop_photos")
      .select("url")
      .eq("id", data.id)
      .eq("shop_id", shop.id)
      .maybeSingle();
    const { error } = await sb
      .from("shop_photos")
      .delete()
      .eq("id", data.id)
      .eq("shop_id", shop.id);
    if (error) throw new Error(error.message);
    // best-effort storage cleanup
    if (photo?.url) {
      const m = photo.url.match(/salon-media\/([^?]+)/);
      if (m) await sb.storage.from("salon-media").remove([m[1]]);
    }
    return { ok: true };
  });

export const reorderGallery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { order: string[] }) =>
    z.object({ order: z.array(z.string().uuid()) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const shop = await loadOwnerShop(sb, context.userId);
    for (let i = 0; i < data.order.length; i++) {
      await sb
        .from("shop_photos")
        .update({ sort: i })
        .eq("id", data.order[i])
        .eq("shop_id", shop.id);
    }
    return { ok: true };
  });

// ------------ SIGNED UPLOAD URL ------------
// Returns a signed URL the client uses to PUT the file directly to storage.
export const createSalonUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { bucket: "salon-media" | "service-media"; filename: string }) =>
      z
        .object({
          bucket: z.enum(["salon-media", "service-media"]),
          filename: z
            .string()
            .min(1)
            .max(200)
            .regex(/^[A-Za-z0-9._-]+$/),
        })
        .parse(d),
  )
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const shop = await loadOwnerShop(sb, context.userId);
    const path = `${shop.id}/${Date.now()}-${data.filename}`;
    const { data: signed, error } = await sb.storage
      .from(data.bucket)
      .createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    const { data: pub } = sb.storage.from(data.bucket).getPublicUrl(path);
    return { path, token: signed.token, signedUrl: signed.signedUrl, publicUrl: pub.publicUrl };
  });

// ------------ DANGER ZONE ------------
export const requestSalonDeletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const shop = await loadOwnerShop(sb, context.userId);
    const { error } = await sb
      .from("shops")
      .update({
        deletion_requested_at: new Date().toISOString(),
        deletion_requested_by: context.userId,
      })
      .eq("id", shop.id);
    if (error) throw new Error(error.message);
    await sb.from("audit_logs").insert({
      actor_id: context.userId,
      action: "shop.deletion_requested",
      target_type: "shop",
      target_id: shop.id,
      details: {},
    });
    return { ok: true };
  });

export const archiveSalon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const shop = await loadOwnerShop(sb, context.userId);
    const { error } = await sb
      .from("shops")
      .update({ archived_at: new Date().toISOString(), published: false })
      .eq("id", shop.id);
    if (error) throw new Error(error.message);
    await sb.from("audit_logs").insert({
      actor_id: context.userId,
      action: "shop.archived",
      target_type: "shop",
      target_id: shop.id,
      details: {},
    });
    return { ok: true };
  });

export const unarchiveSalon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const shop = await loadOwnerShop(sb, context.userId);
    const { error } = await sb
      .from("shops")
      .update({ archived_at: null, published: true })
      .eq("id", shop.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ------------ BARBERS (inline CRUD from public-page editor) ------------
const barberSchema = z.object({
  id: z.string().uuid().optional(),
  display_name_en: z.string().min(1).max(120),
  display_name_ar: z.string().min(1).max(120),
  title_en: z.string().max(120).optional().nullable(),
  title_ar: z.string().max(120).optional().nullable(),
  photo_url: z.string().url().optional().nullable(),
  featured: z.boolean().optional(),
});

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40) || "barber";
}

export const upsertOwnerBarber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => barberSchema.parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const shop = await loadOwnerShop(sb, context.userId);
    if (data.id) {
      const patch: Record<string, unknown> = {
        display_name_en: data.display_name_en,
        display_name_ar: data.display_name_ar,
      };
      if (data.title_en != null) patch.title_en = data.title_en || "Barber";
      if (data.title_ar != null) patch.title_ar = data.title_ar || "حلاق";
      if (data.photo_url !== undefined) patch.photo_url = data.photo_url;
      if (data.featured !== undefined) patch.featured = data.featured;
      const { error } = await sb
        .from("barbers")
        .update(patch as never)
        .eq("id", data.id)
        .eq("shop_id", shop.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const base = slugify(data.display_name_en);
    const slug = `${base}-${Math.random().toString(36).slice(2, 7)}`;
    const { data: row, error } = await sb
      .from("barbers")
      .insert({
        shop_id: shop.id,
        slug,
        display_name_en: data.display_name_en,
        display_name_ar: data.display_name_ar,
        title_en: data.title_en || "Barber",
        title_ar: data.title_ar || "حلاق",
        photo_url: data.photo_url ?? null,
        status: "active",
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteOwnerBarber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const shop = await loadOwnerShop(sb, context.userId);
    const { error } = await sb
      .from("barbers")
      .update({ status: "inactive" as never })
      .eq("id", data.id)
      .eq("shop_id", shop.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ------------ SERVICES (lightweight inline CRUD) ------------
const inlineServiceSchema = z.object({
  id: z.string().uuid().optional(),
  name_en: z.string().min(1).max(120),
  name_ar: z.string().min(1).max(120),
  price_sar: z.number().min(0),
  duration_min: z.number().int().min(1).max(600),
});

export const upsertOwnerService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inlineServiceSchema.parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const shop = await loadOwnerShop(sb, context.userId);
    if (data.id) {
      const { error } = await sb
        .from("services")
        .update({
          name_en: data.name_en,
          name_ar: data.name_ar,
          price_sar: data.price_sar,
          duration_min: data.duration_min,
        } as never)
        .eq("id", data.id)
        .eq("shop_id", shop.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await sb
      .from("services")
      .insert({
        shop_id: shop.id,
        name_en: data.name_en,
        name_ar: data.name_ar,
        price_sar: data.price_sar,
        duration_min: data.duration_min,
        status: "active",
        active: true,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteOwnerService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const shop = await loadOwnerShop(sb, context.userId);
    const { error } = await sb
      .from("services")
      .update({ status: "archived" as never, active: false })
      .eq("id", data.id)
      .eq("shop_id", shop.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ------------ OWNER BARBERS (full CRUD + list) ------------
export const listOwnerBarbers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { search?: string; status?: "all" | "active" | "inactive" | "pending" } | undefined) =>
      d ?? {},
  )
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const shop = await loadOwnerShop(sb, context.userId);
    let q = sb
      .from("barbers")
      .select(
        "id, display_name_en, display_name_ar, title_en, title_ar, photo_url, status, rating_avg, rating_count, created_at, slug",
      )
      .eq("shop_id", shop.id)
      .order("created_at", { ascending: false });
    if (data.search && data.search.trim()) {
      const s = data.search.trim();
      q = q.or(`display_name_en.ilike.%${s}%,display_name_ar.ilike.%${s}%`);
    }
    if (data.status && data.status !== "all") q = q.eq("status", data.status as never);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], shop_id: shop.id };
  });

export const setOwnerBarberStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: "active" | "inactive" }) =>
    z
      .object({ id: z.string().uuid(), status: z.enum(["active", "inactive"]) })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const shop = await loadOwnerShop(sb, context.userId);
    const { error } = await sb
      .from("barbers")
      .update({ status: data.status as never })
      .eq("id", data.id)
      .eq("shop_id", shop.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createOwnerBarberCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const shop = await loadOwnerShop(sb, context.userId);
    const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    function suffix() {
      const b = new Uint8Array(6);
      crypto.getRandomValues(b);
      let out = "";
      for (let i = 0; i < 6; i++) out += ALPHABET[b[i] % ALPHABET.length];
      return out;
    }
    const expiresAt = new Date(Date.now() + 30 * 24 * 3600_000).toISOString();
    for (let i = 0; i < 6; i++) {
      const code = `BAR-${suffix()}`;
      const { data: row, error } = await sb
        .from("invitation_codes")
        .insert({
          code,
          role: "barber",
          shop_id: shop.id,
          expires_at: expiresAt,
          created_by: context.userId,
        } as never)
        .select("id, code, role, shop_id, status, expires_at, created_at")
        .single();
      if (!error) return row;
      if (!String(error.message).toLowerCase().includes("duplicate")) {
        throw new Error(error.message);
      }
    }
    throw new Error("Failed to create invitation code");
  });

export const listOwnerBarberCodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const shop = await loadOwnerShop(sb, context.userId);
    const { data, error } = await sb
      .from("invitation_codes")
      .select("id, code, role, status, expires_at, used_at, created_at")
      .eq("shop_id", shop.id)
      .eq("role", "barber")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const revokeOwnerBarberCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const shop = await loadOwnerShop(sb, context.userId);
    const { error } = await sb
      .from("invitation_codes")
      .update({ status: "revoked" as never })
      .eq("id", data.id)
      .eq("shop_id", shop.id)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ------------ OWNER CUSTOMERS ------------
export const listOwnerCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { search?: string; status?: "all" | "active" | "blocked" } | undefined) => d ?? {})
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const shop = await loadOwnerShop(sb, context.userId);
    const { data: bookings, error } = await sb
      .from("bookings")
      .select("customer_id, price_sar, status, starts_at")
      .eq("shop_id", shop.id);
    if (error) throw new Error(error.message);
    const byCustomer = new Map<string, { visits: number; completed: number; spent: number; last: string | null }>();
    for (const b of bookings ?? []) {
      const id = (b as any).customer_id as string;
      if (!id) continue;
      const cur = byCustomer.get(id) ?? { visits: 0, completed: 0, spent: 0, last: null };
      cur.visits += 1;
      if ((b as any).status === "completed") {
        cur.completed += 1;
        cur.spent += Number((b as any).price_sar ?? 0);
      }
      const t = (b as any).starts_at as string;
      if (!cur.last || (t && t > cur.last)) cur.last = t;
      byCustomer.set(id, cur);
    }
    const ids = Array.from(byCustomer.keys());
    if (ids.length === 0) return { rows: [] };
    const [{ data: profiles }, { data: flags }] = await Promise.all([
      sb
        .from("profiles")
        .select("id, full_name, email, phone, status, created_at")
        .in("id", ids),
      sb
        .from("owner_customer_flags")
        .select("customer_id, notes, blocked_at")
        .eq("shop_id", shop.id)
        .in("customer_id", ids),
    ]);
    const flagMap = new Map<string, { notes: string | null; blocked_at: string | null }>(
      (flags ?? []).map((f: any) => [f.customer_id, { notes: f.notes, blocked_at: f.blocked_at }]),
    );
    let rows = (profiles ?? []).map((p: any) => {
      const stats = byCustomer.get(p.id)!;
      const flag = flagMap.get(p.id);
      return {
        ...p,
        visits: stats.visits,
        completed: stats.completed,
        spent: stats.spent,
        last_visit: stats.last,
        notes: flag?.notes ?? null,
        blocked_at: flag?.blocked_at ?? null,
      };
    });
    if (data.search && data.search.trim()) {
      const s = data.search.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.full_name ?? "").toLowerCase().includes(s) ||
          (r.email ?? "").toLowerCase().includes(s) ||
          (r.phone ?? "").toLowerCase().includes(s),
      );
    }
    if (data.status === "blocked") rows = rows.filter((r) => r.blocked_at);
    if (data.status === "active") rows = rows.filter((r) => !r.blocked_at);
    rows.sort((a, b) => (b.last_visit ?? "").localeCompare(a.last_visit ?? ""));
    return { rows };
  });

export const getOwnerCustomer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const shop = await loadOwnerShop(sb, context.userId);
    const [{ data: profile }, { data: bookings }, { data: reviews }, { data: flag }] =
      await Promise.all([
        sb.from("profiles").select("id, full_name, email, phone, status, created_at").eq("id", data.id).maybeSingle(),
        sb
          .from("bookings")
          .select("id, booking_ref, status, starts_at, price_sar, service_id, barber_id")
          .eq("shop_id", shop.id)
          .eq("customer_id", data.id)
          .order("starts_at", { ascending: false }),
        sb
          .from("reviews")
          .select("id, rating, comment, created_at")
          .eq("shop_id", shop.id)
          .eq("customer_id", data.id)
          .order("created_at", { ascending: false }),
        sb
          .from("owner_customer_flags")
          .select("notes, blocked_at")
          .eq("shop_id", shop.id)
          .eq("customer_id", data.id)
          .maybeSingle(),
      ]);
    if (!profile) throw new Response("Not found", { status: 404 });
    return { profile, bookings: bookings ?? [], reviews: reviews ?? [], flag: flag ?? { notes: null, blocked_at: null } };
  });

export const upsertOwnerCustomerFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { customer_id: string; notes?: string | null; blocked?: boolean }) =>
    z
      .object({
        customer_id: z.string().uuid(),
        notes: z.string().max(2000).optional().nullable(),
        blocked: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const shop = await loadOwnerShop(sb, context.userId);
    const patch: Record<string, unknown> = {
      shop_id: shop.id,
      customer_id: data.customer_id,
    };
    if (data.notes !== undefined) patch.notes = data.notes;
    if (data.blocked !== undefined) patch.blocked_at = data.blocked ? new Date().toISOString() : null;
    const { error } = await sb
      .from("owner_customer_flags")
      .upsert(patch as never, { onConflict: "shop_id,customer_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
