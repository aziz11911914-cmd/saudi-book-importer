import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getShopId(sb: any, userId: string): Promise<string> {
  const { data, error } = await sb
    .from("shops")
    .select("id")
    .eq("manager_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Response("No salon assigned", { status: 404 });
  return data.id;
}

// ------------ LIST PAGE DATA ------------
export const getServicesPage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const shopId = await getShopId(sb, context.userId);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [catRes, svcRes, barbersRes, bsRes, monthBookingsRes] =
      await Promise.all([
        sb
          .from("service_categories")
          .select("*")
          .eq("shop_id", shopId)
          .order("sort_order"),
        sb
          .from("services")
          .select("*")
          .eq("shop_id", shopId)
          .order("display_order"),
        sb
          .from("barbers")
          .select("id, display_name_en, display_name_ar, photo_url, status")
          .eq("shop_id", shopId),
        sb
          .from("barber_services")
          .select("barber_id, service_id, barbers!inner(shop_id)")
          .eq("barbers.shop_id", shopId),
        sb
          .from("bookings")
          .select("service_id, status")
          .eq("shop_id", shopId)
          .gte("starts_at", monthStart.toISOString()),
      ]);

    const monthCounts = new Map<string, number>();
    for (const b of monthBookingsRes.data ?? []) {
      if (b.status === "cancelled" || b.status === "no_show") continue;
      monthCounts.set(b.service_id, (monthCounts.get(b.service_id) ?? 0) + 1);
    }
    const barberMap = new Map<string, string[]>();
    for (const link of bsRes.data ?? []) {
      const arr = barberMap.get(link.service_id) ?? [];
      arr.push(link.barber_id);
      barberMap.set(link.service_id, arr);
    }

    const services = (svcRes.data ?? []).map((s: any) => ({
      ...s,
      barber_ids: barberMap.get(s.id) ?? [],
      bookings_this_month: monthCounts.get(s.id) ?? 0,
    }));

    return {
      categories: catRes.data ?? [],
      services,
      barbers: barbersRes.data ?? [],
    };
  });

// ------------ CATEGORIES ------------
const catSchema = z.object({
  id: z.string().uuid().optional(),
  name_en: z.string().min(1).max(80),
  name_ar: z.string().min(1).max(80),
  sort_order: z.number().int().optional(),
});

export const upsertCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => catSchema.parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const shopId = await getShopId(sb, context.userId);
    if (data.id) {
      const { error } = await sb
        .from("service_categories")
        .update({
          name_en: data.name_en,
          name_ar: data.name_ar,
          ...(data.sort_order !== undefined ? { sort_order: data.sort_order } : {}),
        })
        .eq("id", data.id)
        .eq("shop_id", shopId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await sb
      .from("service_categories")
      .insert({
        shop_id: shopId,
        name_en: data.name_en,
        name_ar: data.name_ar,
        sort_order: data.sort_order ?? 0,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const shopId = await getShopId(sb, context.userId);
    const { error } = await sb
      .from("service_categories")
      .delete()
      .eq("id", data.id)
      .eq("shop_id", shopId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reorderCategories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { order: string[] }) =>
    z.object({ order: z.array(z.string().uuid()) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const shopId = await getShopId(sb, context.userId);
    for (let i = 0; i < data.order.length; i++) {
      await sb
        .from("service_categories")
        .update({ sort_order: i })
        .eq("id", data.order[i])
        .eq("shop_id", shopId);
    }
    return { ok: true };
  });

// ------------ SERVICES CRUD ------------
const svcSchema = z.object({
  id: z.string().uuid().optional(),
  name_en: z.string().min(1).max(120),
  name_ar: z.string().min(1).max(120),
  description_en: z.string().max(2000).optional().nullable(),
  description_ar: z.string().max(2000).optional().nullable(),
  category_id: z.string().uuid().nullable().optional(),
  category: z.string().max(80).optional().nullable(),
  price_sar: z.number().min(0),
  duration_min: z.number().int().min(1),
  prep_minutes: z.number().int().min(0).max(180).default(0),
  cleanup_minutes: z.number().int().min(0).max(180).default(0),
  buffer_minutes: z.number().int().min(0).max(180).default(0),
  status: z.enum(["active", "hidden", "unavailable", "archived"]).default("active"),
  image_url: z.string().url().nullable().optional(),
  color: z.string().max(16).nullable().optional(),
  display_order: z.number().int().default(0),
  featured: z.boolean().default(false),
  popular: z.boolean().default(false),
  recommended: z.boolean().default(false),
  barber_ids: z.array(z.string().uuid()).default([]),
});

export const upsertService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => svcSchema.parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const shopId = await getShopId(sb, context.userId);
    const payload = {
      shop_id: shopId,
      name_en: data.name_en,
      name_ar: data.name_ar,
      description_en: data.description_en ?? null,
      description_ar: data.description_ar ?? null,
      category_id: data.category_id ?? null,
      category: data.category ?? null,
      price_sar: data.price_sar,
      duration_min: data.duration_min,
      prep_minutes: data.prep_minutes,
      cleanup_minutes: data.cleanup_minutes,
      buffer_minutes: data.buffer_minutes,
      status: data.status,
      active: data.status === "active",
      image_url: data.image_url ?? null,
      color: data.color ?? null,
      display_order: data.display_order,
      featured: data.featured,
      popular: data.popular,
      recommended: data.recommended,
    };
    let serviceId: string;
    if (data.id) {
      const { error } = await sb
        .from("services")
        .update(payload as never)
        .eq("id", data.id)
        .eq("shop_id", shopId);
      if (error) throw new Error(error.message);
      serviceId = data.id;
    } else {
      const { data: row, error } = await sb
        .from("services")
        .insert(payload as never)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      serviceId = row.id;
    }
    // sync barber assignments
    await sb.from("barber_services").delete().eq("service_id", serviceId);
    if (data.barber_ids.length) {
      const rows = data.barber_ids.map((bid) => ({
        service_id: serviceId,
        barber_id: bid,
      }));
      const { error: e2 } = await sb.from("barber_services").insert(rows as never);
      if (e2) throw new Error(e2.message);
    }
    await sb.from("audit_logs").insert({
      actor_id: context.userId,
      action: data.id ? "service.updated" : "service.created",
      target_type: "service",
      target_id: serviceId,
      details: { shop_id: shopId, name_en: data.name_en },
    });
    return { id: serviceId };
  });

export const deleteService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const shopId = await getShopId(sb, context.userId);
    // soft-delete by archiving (preserves analytics & past bookings)
    const { error } = await sb
      .from("services")
      .update({ status: "archived" as never, active: false })
      .eq("id", data.id)
      .eq("shop_id", shopId);
    if (error) throw new Error(error.message);
    await sb.from("audit_logs").insert({
      actor_id: context.userId,
      action: "service.archived",
      target_type: "service",
      target_id: data.id,
      details: { shop_id: shopId },
    });
    return { ok: true };
  });

export const duplicateService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const shopId = await getShopId(sb, context.userId);
    const { data: orig, error } = await sb
      .from("services")
      .select("*")
      .eq("id", data.id)
      .eq("shop_id", shopId)
      .single();
    if (error) throw new Error(error.message);
    const copy = {
      ...orig,
      id: undefined,
      created_at: undefined,
      updated_at: undefined,
      name_en: `${orig.name_en} (Copy)`,
      name_ar: `${orig.name_ar} (نسخة)`,
    };
    const { data: row, error: e2 } = await sb
      .from("services")
      .insert(copy as never)
      .select("id")
      .single();
    if (e2) throw new Error(e2.message);
    const { data: links } = await sb
      .from("barber_services")
      .select("barber_id")
      .eq("service_id", data.id);
    if (links?.length) {
      await sb
        .from("barber_services")
        .insert(
          links.map((l: any) => ({ service_id: row.id, barber_id: l.barber_id })) as never,
        );
    }
    return row;
  });

export const bulkUpdateServices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      ids: string[];
      action: "activate" | "hide" | "archive" | "category" | "barber";
      category_id?: string | null;
      barber_id?: string;
    }) =>
      z
        .object({
          ids: z.array(z.string().uuid()).min(1),
          action: z.enum(["activate", "hide", "archive", "category", "barber"]),
          category_id: z.string().uuid().nullable().optional(),
          barber_id: z.string().uuid().optional(),
        })
        .parse(d),
  )
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const shopId = await getShopId(sb, context.userId);
    if (data.action === "activate") {
      await sb
        .from("services")
        .update({ status: "active" as never, active: true })
        .in("id", data.ids)
        .eq("shop_id", shopId);
    } else if (data.action === "hide") {
      await sb
        .from("services")
        .update({ status: "hidden" as never, active: false })
        .in("id", data.ids)
        .eq("shop_id", shopId);
    } else if (data.action === "archive") {
      await sb
        .from("services")
        .update({ status: "archived" as never, active: false })
        .in("id", data.ids)
        .eq("shop_id", shopId);
    } else if (data.action === "category") {
      await sb
        .from("services")
        .update({ category_id: (data.category_id ?? null) as never })
        .in("id", data.ids)
        .eq("shop_id", shopId);
    } else if (data.action === "barber" && data.barber_id) {
      const rows = data.ids.map((sid) => ({
        service_id: sid,
        barber_id: data.barber_id!,
      }));
      // insert ignore via upsert
      await sb
        .from("barber_services")
        .upsert(rows as never, { onConflict: "barber_id,service_id" });
    }
    return { ok: true };
  });
