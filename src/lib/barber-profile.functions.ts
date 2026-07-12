import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ------------ AUTHORIZATION ------------
async function assertCanEditBarber(sb: any, userId: string, barberId: string) {
  const { data: barber, error } = await sb
    .from("barbers")
    .select("id, profile_id, shop_id")
    .eq("id", barberId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!barber) throw new Error("Barber not found");
  if (barber.profile_id === userId) return barber;
  const { data: role } = await sb.rpc("has_role", {
    _user_id: userId,
    _role: "super_admin",
  });
  if (role === true) return barber;
  if (barber.shop_id) {
    const { data: shop } = await sb
      .from("shops")
      .select("manager_id")
      .eq("id", barber.shop_id)
      .maybeSingle();
    if (shop?.manager_id === userId) return barber;
  }
  throw new Error("Forbidden");
}

// ------------ SIGNED UPLOAD URL ------------
const uploadInput = z.object({
  barberId: z.string().uuid(),
  filename: z.string().min(1).max(200).regex(/^[A-Za-z0-9._-]+$/),
  kind: z.enum(["photo", "cover", "portfolio"]),
});
export const createBarberUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof uploadInput>) => uploadInput.parse(d))
  .handler(async ({ context, data }) => {
    await assertCanEditBarber(context.supabase, context.userId, data.barberId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const subdir = data.kind === "portfolio" ? "portfolio" : data.kind;
    const path = `barbers/${data.barberId}/${subdir}/${Date.now()}-${data.filename}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from("salon-media")
      .createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    const { data: pub } = supabaseAdmin.storage.from("salon-media").getPublicUrl(path);
    return { path, token: signed.token, signedUrl: signed.signedUrl, publicUrl: pub.publicUrl };
  });

// ------------ PROFILE FIELDS ------------
const updateBioInput = z.object({
  barberId: z.string().uuid(),
  bio_en: z.string().max(2000).nullable().optional(),
  bio_ar: z.string().max(2000).nullable().optional(),
});
export const updateBarberBio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof updateBioInput>) => updateBioInput.parse(d))
  .handler(async ({ context, data }) => {
    await assertCanEditBarber(context.supabase, context.userId, data.barberId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = {};
    if (data.bio_en !== undefined) patch.bio_en = data.bio_en;
    if (data.bio_ar !== undefined) patch.bio_ar = data.bio_ar;
    const { error } = await supabaseAdmin.from("barbers").update(patch).eq("id", data.barberId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const setImageInput = z.object({
  barberId: z.string().uuid(),
  field: z.enum(["photo_url", "cover_url"]),
  url: z.string().url().nullable(),
});
export const setBarberImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof setImageInput>) => setImageInput.parse(d))
  .handler(async ({ context, data }) => {
    await assertCanEditBarber(context.supabase, context.userId, data.barberId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Best-effort: remove previous file from storage if it lived in salon-media
    const { data: prev } = await supabaseAdmin
      .from("barbers")
      .select(data.field)
      .eq("id", data.barberId)
      .maybeSingle();
    const prevUrl = (prev as any)?.[data.field] as string | null | undefined;
    if (prevUrl) {
      const m = prevUrl.match(/salon-media\/([^?]+)/);
      if (m) await supabaseAdmin.storage.from("salon-media").remove([m[1]]).catch(() => null);
    }
    const patch: Record<string, unknown> = { [data.field]: data.url };
    const { error } = await supabaseAdmin.from("barbers").update(patch).eq("id", data.barberId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ------------ SERVICES (barber-level enable/disable) ------------
const toggleServiceInput = z.object({
  barberId: z.string().uuid(),
  serviceId: z.string().uuid(),
  enabled: z.boolean(),
});
export const toggleBarberService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof toggleServiceInput>) => toggleServiceInput.parse(d))
  .handler(async ({ context, data }) => {
    await assertCanEditBarber(context.supabase, context.userId, data.barberId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.enabled) {
      const { error } = await supabaseAdmin
        .from("barber_services")
        .upsert({ barber_id: data.barberId, service_id: data.serviceId });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("barber_services")
        .delete()
        .eq("barber_id", data.barberId)
        .eq("service_id", data.serviceId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// ------------ SERVICES (shop-level edit, owner/admin only) ------------
async function assertShopEditForBarber(sb: any, userId: string, barberId: string) {
  const barber = await assertCanEditBarber(sb, userId, barberId);
  // Only owner/admin may edit shop-level service pricing. A barber-self can't.
  if (barber.profile_id === userId) {
    // check if also owner/admin
    const { data: isAdmin } = await sb.rpc("has_role", {
      _user_id: userId,
      _role: "super_admin",
    });
    if (isAdmin === true) return barber;
    if (barber.shop_id) {
      const { data: shop } = await sb
        .from("shops")
        .select("manager_id")
        .eq("id", barber.shop_id)
        .maybeSingle();
      if (shop?.manager_id === userId) return barber;
    }
    throw new Error("Only shop owner or admin can edit services");
  }
  return barber;
}
const updateServiceInput = z.object({
  barberId: z.string().uuid(),
  serviceId: z.string().uuid(),
  price_sar: z.number().min(0).max(100000).optional(),
  duration_min: z.number().int().min(5).max(600).optional(),
});
export const updateBarberServiceDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof updateServiceInput>) => updateServiceInput.parse(d))
  .handler(async ({ context, data }) => {
    const barber = await assertShopEditForBarber(
      context.supabase,
      context.userId,
      data.barberId,
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = {};
    if (data.price_sar !== undefined) patch.price_sar = data.price_sar;
    if (data.duration_min !== undefined) patch.duration_min = data.duration_min;
    if (!Object.keys(patch).length) return { ok: true };
    const { error } = await supabaseAdmin
      .from("services")
      .update(patch)
      .eq("id", data.serviceId)
      .eq("shop_id", barber.shop_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ------------ PORTFOLIO ------------
const addPhotoInput = z.object({
  barberId: z.string().uuid(),
  url: z.string().url(),
  caption_en: z.string().max(200).nullable().optional(),
  caption_ar: z.string().max(200).nullable().optional(),
});
export const addPortfolioPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof addPhotoInput>) => addPhotoInput.parse(d))
  .handler(async ({ context, data }) => {
    await assertCanEditBarber(context.supabase, context.userId, data.barberId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: maxRow } = await supabaseAdmin
      .from("portfolio_photos")
      .select("sort")
      .eq("barber_id", data.barberId)
      .order("sort", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextSort = ((maxRow?.sort ?? -1) as number) + 1;
    const { data: row, error } = await supabaseAdmin
      .from("portfolio_photos")
      .insert({
        barber_id: data.barberId,
        url: data.url,
        caption_en: data.caption_en ?? null,
        caption_ar: data.caption_ar ?? null,
        sort: nextSort,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, photo: row };
  });

const replacePhotoInput = z.object({
  barberId: z.string().uuid(),
  photoId: z.string().uuid(),
  url: z.string().url(),
});
export const replacePortfolioPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof replacePhotoInput>) => replacePhotoInput.parse(d))
  .handler(async ({ context, data }) => {
    await assertCanEditBarber(context.supabase, context.userId, data.barberId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prev } = await supabaseAdmin
      .from("portfolio_photos")
      .select("url")
      .eq("id", data.photoId)
      .eq("barber_id", data.barberId)
      .maybeSingle();
    if (prev?.url) {
      const m = prev.url.match(/salon-media\/([^?]+)/);
      if (m) await supabaseAdmin.storage.from("salon-media").remove([m[1]]).catch(() => null);
    }
    const { error } = await supabaseAdmin
      .from("portfolio_photos")
      .update({ url: data.url })
      .eq("id", data.photoId)
      .eq("barber_id", data.barberId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const deletePhotoInput = z.object({
  barberId: z.string().uuid(),
  photoId: z.string().uuid(),
});
export const deletePortfolioPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof deletePhotoInput>) => deletePhotoInput.parse(d))
  .handler(async ({ context, data }) => {
    await assertCanEditBarber(context.supabase, context.userId, data.barberId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prev } = await supabaseAdmin
      .from("portfolio_photos")
      .select("url")
      .eq("id", data.photoId)
      .eq("barber_id", data.barberId)
      .maybeSingle();
    const { error } = await supabaseAdmin
      .from("portfolio_photos")
      .delete()
      .eq("id", data.photoId)
      .eq("barber_id", data.barberId);
    if (error) throw new Error(error.message);
    if (prev?.url) {
      const m = prev.url.match(/salon-media\/([^?]+)/);
      if (m) await supabaseAdmin.storage.from("salon-media").remove([m[1]]).catch(() => null);
    }
    return { ok: true };
  });
