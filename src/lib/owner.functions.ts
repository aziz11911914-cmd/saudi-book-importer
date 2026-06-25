import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- helpers ----------
async function getOwnerShop(sb: any, userId: string) {
  const { data, error } = await sb
    .from("shops")
    .select(
      "id, slug, name_en, name_ar, city, district, address, phone, whatsapp, email, status, logo_url, cover_url, rating_avg, rating_count, booking_enabled, walkin_enabled, accept_reviews, created_at",
    )
    .eq("manager_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Response("No salon assigned", { status: 404 });
  return data;
}

async function assertOwnerOfShop(sb: any, userId: string, shopId: string) {
  const { data, error } = await sb
    .from("shops")
    .select("id")
    .eq("id", shopId)
    .eq("manager_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Response("Forbidden", { status: 403 });
}

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

// ---------- owner shop (header info) ----------
export const getOwnerShop_fn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return await getOwnerShop(context.supabase, context.userId);
  });

// ---------- DASHBOARD ----------
export const getOwnerDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const shop = await getOwnerShop(sb, context.userId);

    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const yStart = new Date(todayStart); yStart.setDate(yStart.getDate() - 1);
    const yEnd = new Date(todayEnd); yEnd.setDate(yEnd.getDate() - 1);
    const weekAgo = new Date(todayStart); weekAgo.setDate(weekAgo.getDate() - 7);

    const dayOfWeek = now.getDay(); // 0=Sun..6=Sat

    const [
      todayBookingsRes,
      yesterdayBookingsRes,
      barbersRes,
      pendingReviewsRes,
      newCustomersRes,
      activityRes,
      invitesRes,
      recentReviewsRes,
      hoursRes,
    ] = await Promise.all([
      sb
        .from("bookings")
        .select(
          "id, booking_ref, starts_at, ends_at, status, price_sar, notes, customer_id, barber_id, service_id",
        )
        .eq("shop_id", shop.id)
        .gte("starts_at", todayStart.toISOString())
        .lte("starts_at", todayEnd.toISOString())
        .order("starts_at", { ascending: true }),
      sb
        .from("bookings")
        .select("id, status", { count: "exact" })
        .eq("shop_id", shop.id)
        .gte("starts_at", yStart.toISOString())
        .lte("starts_at", yEnd.toISOString()),
      sb
        .from("barbers")
        .select(
          "id, display_name_en, display_name_ar, photo_url, status, rating_avg, rating_count",
        )
        .eq("shop_id", shop.id),
      sb
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .eq("shop_id", shop.id)
        .is("hidden_at", null),
      sb
        .from("bookings")
        .select("customer_id, created_at")
        .eq("shop_id", shop.id)
        .gte("created_at", weekAgo.toISOString()),
      sb
        .from("audit_logs")
        .select("id, action, target_type, target_id, actor_email, created_at, details")
        .or(`target_id.eq.${shop.id},details->>shop_id.eq.${shop.id}`)
        .order("created_at", { ascending: false })
        .limit(15),
      sb
        .from("invites")
        .select("id, email, role, full_name, token, status, created_at, expires_at")
        .eq("shop_id", shop.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      sb
        .from("reviews")
        .select("id, rating, comment, created_at, customer_id, barber_id, booking_id")
        .eq("shop_id", shop.id)
        .is("hidden_at", null)
        .order("created_at", { ascending: false })
        .limit(5),
      sb
        .from("shop_hours")
        .select("day_of_week, opens_at, closes_at")
        .eq("shop_id", shop.id)
        .eq("day_of_week", dayOfWeek),
    ]);

    const todayBookings = todayBookingsRes.data ?? [];
    const yesterdayBookings = yesterdayBookingsRes.data ?? [];
    const barbers = barbersRes.data ?? [];
    const invites = invitesRes.data ?? [];
    const recentReviews = recentReviewsRes.data ?? [];
    const todayHours = hoursRes.data ?? [];

    // hydrate names
    const customerIds = Array.from(
      new Set([
        ...todayBookings.map((b: any) => b.customer_id),
        ...recentReviews.map((r: any) => r.customer_id),
      ]),
    );
    const serviceIds = Array.from(new Set(todayBookings.map((b: any) => b.service_id)));

    const [profilesRes, servicesRes] = await Promise.all([
      customerIds.length
        ? sb
            .from("profiles")
            .select("id, full_name, email, phone, avatar_url")
            .in("id", customerIds)
        : Promise.resolve({ data: [] }),
      serviceIds.length
        ? sb
            .from("services")
            .select("id, name_en, name_ar, duration_min, price_sar")
            .in("id", serviceIds)
        : Promise.resolve({ data: [] }),
    ]);

    const profileMap = new Map(
      (profilesRes.data ?? []).map((p: any) => [p.id, p]),
    );
    const serviceMap = new Map((servicesRes.data ?? []).map((s: any) => [s.id, s]));
    const barberMap = new Map(barbers.map((b: any) => [b.id, b]));

    // KPI: today's bookings + delta
    const todayCount = todayBookings.length;
    const yCount = yesterdayBookings.length;
    const deltaPct =
      yCount === 0
        ? todayCount > 0
          ? 100
          : 0
        : Math.round(((todayCount - yCount) / yCount) * 100);

    // KPI: occupancy (booked-minutes / available-minutes)
    let occupancy = 0;
    let openMin = 0;
    if (todayHours.length > 0) {
      const [oh, om] = String(todayHours[0].opens_at).split(":").map(Number);
      const [ch, cm] = String(todayHours[0].closes_at).split(":").map(Number);
      openMin = ch * 60 + cm - (oh * 60 + om);
    }
    const activeBarbers = barbers.filter((b: any) => b.status === "active").length;
    const availableMin = openMin * Math.max(activeBarbers, 1);
    const bookedMin = todayBookings
      .filter((b: any) => b.status !== "cancelled" && b.status !== "no_show")
      .reduce((acc: number, b: any) => {
        const s = new Date(b.starts_at).getTime();
        const e = new Date(b.ends_at).getTime();
        return acc + Math.max(0, (e - s) / 60000);
      }, 0);
    occupancy =
      availableMin > 0 ? Math.min(100, Math.round((bookedMin / availableMin) * 100)) : 0;

    // KPI: barber availability counts
    const nowTs = now.getTime();
    const isBusy = (barberId: string) =>
      todayBookings.some(
        (b: any) =>
          b.barber_id === barberId &&
          (b.status === "confirmed" || b.status === "pending") &&
          new Date(b.starts_at).getTime() <= nowTs &&
          new Date(b.ends_at).getTime() > nowTs,
      );
    let working = 0,
      busy = 0,
      off = 0;
    for (const b of barbers) {
      if (b.status !== "active") {
        off++;
        continue;
      }
      if (isBusy(b.id)) busy++;
      else working++;
    }

    // KPI: new customers this week (first booking with this shop in last 7d)
    // newCustomersRes returns all bookings (created_at >= weekAgo). For each customer_id,
    // check if their earliest booking is also in last 7d.
    const firstBookingByCustomer = new Map<string, string>();
    for (const b of newCustomersRes.data ?? []) {
      const prev = firstBookingByCustomer.get(b.customer_id);
      if (!prev || new Date(b.created_at) < new Date(prev)) {
        firstBookingByCustomer.set(b.customer_id, b.created_at);
      }
    }
    // verify no earlier booking exists
    const candidateIds = Array.from(firstBookingByCustomer.keys());
    let newCustomers = 0;
    if (candidateIds.length) {
      const { data: priorRows } = await sb
        .from("bookings")
        .select("customer_id")
        .eq("shop_id", shop.id)
        .lt("created_at", weekAgo.toISOString())
        .in("customer_id", candidateIds);
      const priorSet = new Set((priorRows ?? []).map((r: any) => r.customer_id));
      newCustomers = candidateIds.filter((id) => !priorSet.has(id)).length;
    }

    // Today performance
    const completed = todayBookings.filter((b: any) => b.status === "completed").length;
    const upcoming = todayBookings.filter(
      (b: any) =>
        (b.status === "confirmed" || b.status === "pending") &&
        new Date(b.starts_at).getTime() > nowTs,
    ).length;
    const cancelled = todayBookings.filter((b: any) => b.status === "cancelled").length;
    const noShow = todayBookings.filter((b: any) => b.status === "no_show").length;
    const todayReviewIds = todayBookings.map((b: any) => b.id);
    let avgRatingToday: number | null = null;
    if (todayReviewIds.length) {
      const { data: ratings } = await sb
        .from("reviews")
        .select("rating")
        .in("booking_id", todayReviewIds);
      const arr = (ratings ?? []).map((r: any) => Number(r.rating)).filter(Boolean);
      avgRatingToday = arr.length
        ? Number((arr.reduce((a: number, b: number) => a + b, 0) / arr.length).toFixed(2))
        : null;
    }

    // Schedule with hydrated names
    const schedule = todayBookings.map((b: any) => ({
      id: b.id,
      booking_ref: b.booking_ref,
      starts_at: b.starts_at,
      ends_at: b.ends_at,
      status: b.status,
      price_sar: b.price_sar,
      notes: b.notes,
      customer: profileMap.get(b.customer_id) ?? null,
      barber: barberMap.get(b.barber_id) ?? null,
      service: serviceMap.get(b.service_id) ?? null,
    }));

    // Reviews with hydrated names
    const reviews = recentReviews.map((r: any) => ({
      ...r,
      customer: profileMap.get(r.customer_id) ?? null,
      barber: barberMap.get(r.barber_id) ?? null,
    }));

    // Next customer = next non-cancelled upcoming booking
    const nextBooking = schedule.find(
      (b: any) =>
        (b.status === "confirmed" || b.status === "pending") &&
        new Date(b.starts_at).getTime() > nowTs,
    );

    // Barber status cards
    const barberStatus = barbers.map((b: any) => {
      const todayList = todayBookings.filter(
        (x: any) => x.barber_id === b.id && x.status !== "cancelled" && x.status !== "no_show",
      );
      const current = todayList.find(
        (x: any) =>
          new Date(x.starts_at).getTime() <= nowTs &&
          new Date(x.ends_at).getTime() > nowTs,
      );
      let liveStatus: "Available" | "Busy" | "Off" = "Off";
      if (b.status === "active") liveStatus = current ? "Busy" : "Available";
      return {
        id: b.id,
        display_name_en: b.display_name_en,
        display_name_ar: b.display_name_ar,
        photo_url: b.photo_url,
        rating_avg: b.rating_avg,
        live_status: liveStatus,
        today_count: todayList.length,
        current_booking: current
          ? {
              id: current.id,
              starts_at: current.starts_at,
              ends_at: current.ends_at,
              service: serviceMap.get(current.service_id) ?? null,
              customer: profileMap.get(current.customer_id) ?? null,
            }
          : null,
      };
    });

    return {
      shop,
      now: now.toISOString(),
      kpis: {
        todayBookings: { count: todayCount, deltaPct, yesterday: yCount },
        occupancy: { pct: occupancy, label: occupancy >= 80 ? "High" : occupancy >= 50 ? "Moderate" : "Low" },
        barbers: { working, busy, off, breakCount: 0, total: barbers.length },
        pendingReviews: pendingReviewsRes.count ?? 0,
        newCustomers,
      },
      schedule,
      nextBooking,
      recentActivity: activityRes.data ?? [],
      pendingInvitations: invites,
      recentReviews: reviews,
      barberStatus,
      todayPerformance: {
        completed,
        upcoming,
        cancelled,
        noShow,
        avgRating: avgRatingToday,
      },
    };
  });

// ---------- BOOKING ACTIONS ----------
export const setBookingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { bookingId: string; status: "pending" | "confirmed" | "completed" | "cancelled" | "no_show"; reason?: string }) =>
    z
      .object({
        bookingId: z.string().uuid(),
        status: z.enum(["pending", "confirmed", "completed", "cancelled", "no_show"]),
        reason: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const { data: b, error } = await sb
      .from("bookings")
      .select("id, shop_id, status")
      .eq("id", data.bookingId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!b) throw new Response("Not found", { status: 404 });
    await assertOwnerOfShop(sb, context.userId, b.shop_id);

    const update: any = { status: data.status };
    if (data.status === "cancelled") {
      update.cancelled_at = new Date().toISOString();
      update.cancelled_by = context.userId;
      if (data.reason) update.cancel_reason = data.reason;
    }
    const { error: uErr } = await sb.from("bookings").update(update).eq("id", data.bookingId);
    if (uErr) throw new Error(uErr.message);

    await sb.from("audit_logs").insert({
      actor_id: context.userId,
      action: `booking.${data.status}`,
      target_type: "booking",
      target_id: data.bookingId,
      details: { shop_id: b.shop_id, reason: data.reason ?? null },
    });
    return { ok: true };
  });

// ---------- INVITE ACTIONS (barber invite from owner dashboard) ----------
export const inviteBarberFromOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string; full_name?: string; phone?: string }) =>
    z
      .object({
        email: z.string().email(),
        full_name: z.string().optional(),
        phone: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const shop = await getOwnerShop(sb, context.userId);
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const expires = new Date(); expires.setDate(expires.getDate() + 14);
    const { data: inv, error } = await sb
      .from("invites")
      .insert({
        email: data.email.toLowerCase(),
        role: "barber",
        shop_id: shop.id,
        token,
        invited_by: context.userId,
        expires_at: expires.toISOString(),
        status: "pending",
        full_name: data.full_name ?? null,
        phone: data.phone ?? null,
      })
      .select("id, token, email, full_name, expires_at")
      .single();
    if (error) throw new Error(error.message);

    await sb.from("audit_logs").insert({
      actor_id: context.userId,
      action: "invite.barber.created",
      target_type: "invite",
      target_id: inv.id,
      details: { shop_id: shop.id, email: data.email },
    });
    return inv;
  });

export const cancelInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    // RLS guarantees the owner can only update invites for their shop
    const { error } = await sb
      .from("invites")
      .update({ status: "revoked" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await sb.from("audit_logs").insert({
      actor_id: context.userId,
      action: "invite.cancelled",
      target_type: "invite",
      target_id: data.id,
      details: {},
    });
    return { ok: true };
  });

export const resendInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const expires = new Date(); expires.setDate(expires.getDate() + 14);
    const { data: inv, error } = await sb
      .from("invites")
      .update({ expires_at: expires.toISOString(), status: "pending" })
      .eq("id", data.id)
      .select("id, token")
      .single();
    if (error) throw new Error(error.message);
    return inv;
  });
