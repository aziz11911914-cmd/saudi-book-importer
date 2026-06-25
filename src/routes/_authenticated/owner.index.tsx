import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarCheck, TrendingUp, TrendingDown, Activity, Users, Star,
  UserPlus, Wallet, Plus, Scissors, Sparkles, Store, Calendar,
  Clock, CheckCircle2, XCircle, AlertCircle, Phone, MessageSquare,
  CircleDot, Mail, Copy, RefreshCw, X as XIcon, ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getOwnerDashboard, setBookingStatus, cancelInvite, resendInvite, inviteBarberFromOwner,
} from "@/lib/owner.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/owner/")({
  component: OwnerDashboardPage,
});

// ---------------- helpers ----------------
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}
function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
function statusTone(s: string) {
  switch (s) {
    case "confirmed": return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "pending": return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "completed": return "bg-blue-500/15 text-blue-400 border-blue-500/30";
    case "cancelled": return "bg-rose-500/15 text-rose-400 border-rose-500/30";
    case "no_show": return "bg-zinc-500/15 text-zinc-400 border-zinc-500/30";
    default: return "bg-muted text-muted-foreground border-hairline";
  }
}

// ---------------- page ----------------
function OwnerDashboardPage() {
  const fn = useServerFn(getOwnerDashboard);
  const qc = useQueryClient();
  const [now, setNow] = useState(new Date());
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [inviteSheet, setInviteSheet] = useState(false);

  const { data, isLoading, error, dataUpdatedAt } = useQuery({
    queryKey: ["owner", "dashboard"],
    queryFn: () => fn(),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  // live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // realtime invalidation on bookings/reviews/invites for this shop
  useEffect(() => {
    if (!data?.shop?.id) return;
    const ch = supabase
      .channel(`owner-shop-${data.shop.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `shop_id=eq.${data.shop.id}` },
        () => qc.invalidateQueries({ queryKey: ["owner", "dashboard"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "reviews", filter: `shop_id=eq.${data.shop.id}` },
        () => qc.invalidateQueries({ queryKey: ["owner", "dashboard"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "invites", filter: `shop_id=eq.${data.shop.id}` },
        () => qc.invalidateQueries({ queryKey: ["owner", "dashboard"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [data?.shop?.id, qc]);

  if (isLoading) {
    return <div className="grid h-[60vh] place-items-center text-muted-foreground">Loading dashboard…</div>;
  }
  if (error || !data) {
    return (
      <div className="mx-auto max-w-xl space-y-3 px-6 py-16 text-center">
        <AlertCircle className="mx-auto size-10 text-muted-foreground" />
        <h1 className="font-display text-2xl">No salon assigned</h1>
        <p className="text-sm text-muted-foreground">
          Your account is not linked to a salon yet. Please contact your platform administrator.
        </p>
      </div>
    );
  }

  const { shop, kpis, schedule, recentActivity, pendingInvitations, recentReviews, barberStatus, todayPerformance, nextBooking } = data;
  const lastSync = dataUpdatedAt ? new Date(dataUpdatedAt) : now;

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{greeting(now)},</p>
          <h1 className="font-display text-2xl sm:text-3xl">{shop.name_en}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {fmtDate(now)} · {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            <span className="mx-2">·</span>
            Last sync {fmtTime(lastSync.toISOString())}
          </p>
        </div>
        {nextBooking && (
          <div className="rounded-2xl border border-hairline bg-surface px-4 py-2 text-xs">
            <span className="text-muted-foreground">Next customer · </span>
            <span className="font-semibold">{nextBooking.customer?.full_name ?? nextBooking.customer?.email ?? "—"}</span>
            <span className="mx-1 text-muted-foreground">at</span>
            <span className="font-semibold">{fmtTime(nextBooking.starts_at)}</span>
          </div>
        )}
      </header>

      {/* KPI cards */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiTodayBookings kpi={kpis.todayBookings} />
        <KpiOccupancy kpi={kpis.occupancy} />
        <KpiBarbers kpi={kpis.barbers} />
        <KpiPendingReviews count={kpis.pendingReviews} />
        <KpiNewCustomers count={kpis.newCustomers} />
        <KpiRevenue />
      </section>

      {/* Quick actions */}
      <QuickActions onInvite={() => setInviteSheet(true)} />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Today's schedule */}
        <section className="lg:col-span-2 rounded-2xl border border-hairline bg-surface">
          <header className="flex items-center justify-between border-b border-hairline px-5 py-3">
            <h2 className="font-display text-lg">Today's Schedule</h2>
            <Link to="/owner/calendar" className="text-xs text-gold hover:underline">Open Calendar</Link>
          </header>
          {schedule.length === 0 ? (
            <div className="grid place-items-center px-6 py-16 text-sm text-muted-foreground">
              No bookings today.
            </div>
          ) : (
            <ul className="divide-y divide-hairline">
              {schedule.map((b: any) => (
                <li key={b.id}>
                  <button
                    onClick={() => setSelectedBooking(b)}
                    className="flex w-full items-center gap-4 px-5 py-3 text-start hover:bg-background/50"
                  >
                    <div className="w-16 shrink-0 font-mono text-sm">
                      {fmtTime(b.starts_at)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {b.customer?.full_name ?? b.customer?.email ?? "Customer"}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {b.service?.name_en ?? "Service"} · {b.barber?.display_name_en ?? "—"}
                      </div>
                    </div>
                    <span className={cn("rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide", statusTone(b.status))}>
                      {b.status.replace("_", " ")}
                    </span>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Barber status */}
        <section className="rounded-2xl border border-hairline bg-surface">
          <header className="flex items-center justify-between border-b border-hairline px-5 py-3">
            <h2 className="font-display text-lg">Barber Status</h2>
            <Link to="/owner/barbers" className="text-xs text-gold hover:underline">Manage</Link>
          </header>
          {barberStatus.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              No barbers yet. <Link to="/owner/barbers" className="text-gold hover:underline">Invite one</Link>.
            </div>
          ) : (
            <ul className="divide-y divide-hairline">
              {barberStatus.map((b: any) => (
                <li key={b.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-background">
                    {b.photo_url ? (
                      <img src={b.photo_url} alt="" className="size-full object-cover" />
                    ) : (
                      <Scissors className="size-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{b.display_name_en}</div>
                    <div className="text-xs text-muted-foreground">{b.today_count} booking{b.today_count === 1 ? "" : "s"} today</div>
                  </div>
                  <span className={cn(
                    "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase",
                    b.live_status === "Available" && "border-emerald-500/30 bg-emerald-500/15 text-emerald-400",
                    b.live_status === "Busy" && "border-amber-500/30 bg-amber-500/15 text-amber-400",
                    b.live_status === "Off" && "border-zinc-500/30 bg-zinc-500/15 text-zinc-400",
                  )}>
                    <CircleDot className="size-2.5" />
                    {b.live_status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Today performance */}
        <section className="rounded-2xl border border-hairline bg-surface p-5">
          <h2 className="font-display text-lg">Today Performance</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Perf icon={CheckCircle2} label="Completed" value={todayPerformance.completed} tone="emerald" />
            <Perf icon={Clock} label="Upcoming" value={todayPerformance.upcoming} tone="amber" />
            <Perf icon={XCircle} label="Cancelled" value={todayPerformance.cancelled} tone="rose" />
            <Perf icon={AlertCircle} label="No-shows" value={todayPerformance.noShow} tone="zinc" />
            <Perf icon={Star} label="Avg rating" value={todayPerformance.avgRating ?? "—"} tone="gold" />
          </div>
        </section>

        {/* Pending invitations */}
        <section className="rounded-2xl border border-hairline bg-surface">
          <header className="flex items-center justify-between border-b border-hairline px-5 py-3">
            <h2 className="font-display text-lg">Pending Invitations</h2>
            <button onClick={() => setInviteSheet(true)} className="inline-flex items-center gap-1 text-xs text-gold hover:underline">
              <UserPlus className="size-3.5" /> Invite barber
            </button>
          </header>
          {pendingInvitations.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">No pending invitations.</div>
          ) : (
            <ul className="divide-y divide-hairline">
              {pendingInvitations.map((i: any) => <InviteRow key={i.id} invite={i} />)}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent reviews */}
        <section className="rounded-2xl border border-hairline bg-surface">
          <header className="flex items-center justify-between border-b border-hairline px-5 py-3">
            <h2 className="font-display text-lg">Recent Reviews</h2>
            <Link to="/owner/reviews" className="text-xs text-gold hover:underline">View all</Link>
          </header>
          {recentReviews.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">No reviews yet.</div>
          ) : (
            <ul className="divide-y divide-hairline">
              {recentReviews.map((r: any) => (
                <li key={r.id} className="px-5 py-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gold">{"★".repeat(r.rating)}<span className="text-muted-foreground">{"★".repeat(5 - r.rating)}</span></span>
                    <span className="text-xs text-muted-foreground">
                      {r.customer?.full_name ?? "Customer"} · {r.barber?.display_name_en ?? ""}
                    </span>
                    <span className="ms-auto text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                  {r.comment && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{r.comment}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recent activity */}
        <section className="rounded-2xl border border-hairline bg-surface">
          <header className="flex items-center justify-between border-b border-hairline px-5 py-3">
            <h2 className="font-display text-lg">Recent Activity</h2>
            <Activity className="size-4 text-muted-foreground" />
          </header>
          {recentActivity.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">No activity yet.</div>
          ) : (
            <ul className="divide-y divide-hairline">
              {recentActivity.map((a: any) => (
                <li key={a.id} className="flex items-start justify-between gap-3 px-5 py-2.5 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{a.action}</div>
                    <div className="truncate text-xs text-muted-foreground">{a.actor_email ?? "system"} · {a.target_type ?? ""}</div>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {selectedBooking && (
        <BookingDrawer
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onChanged={() => { setSelectedBooking(null); qc.invalidateQueries({ queryKey: ["owner", "dashboard"] }); }}
        />
      )}

      {inviteSheet && <InviteBarberDrawer onClose={() => setInviteSheet(false)} onDone={() => { setInviteSheet(false); qc.invalidateQueries({ queryKey: ["owner", "dashboard"] }); }} />}
    </div>
  );
}

// ---------------- KPI cards ----------------
function KpiCard({ icon: Icon, label, children, accent }: any) {
  return (
    <div className="rounded-2xl border border-hairline bg-surface p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
        <Icon className={cn("size-4", accent ? "text-gold" : "text-muted-foreground")} />
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}
function KpiTodayBookings({ kpi }: any) {
  const up = kpi.deltaPct >= 0;
  return (
    <KpiCard icon={CalendarCheck} label="Today's Bookings" accent>
      <div className="font-display text-3xl">{kpi.count}</div>
      <div className={cn("mt-1 inline-flex items-center gap-1 text-xs", up ? "text-emerald-400" : "text-rose-400")}>
        {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
        {Math.abs(kpi.deltaPct)}% vs yesterday ({kpi.yesterday})
      </div>
    </KpiCard>
  );
}
function KpiOccupancy({ kpi }: any) {
  return (
    <KpiCard icon={Activity} label="Occupancy Rate">
      <div className="font-display text-3xl">{kpi.pct}%</div>
      <div className="mt-1 text-xs text-muted-foreground">{kpi.label} occupancy</div>
    </KpiCard>
  );
}
function KpiBarbers({ kpi }: any) {
  return (
    <KpiCard icon={Scissors} label="Available Barbers">
      <div className="font-display text-3xl">{kpi.working}<span className="text-base text-muted-foreground">/{kpi.total}</span></div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
        <span><b className="text-foreground">{kpi.working}</b> working</span>
        <span><b className="text-foreground">{kpi.busy}</b> busy</span>
        <span><b className="text-foreground">{kpi.off}</b> off</span>
      </div>
    </KpiCard>
  );
}
function KpiPendingReviews({ count }: any) {
  return (
    <Link to="/owner/reviews" className="block">
      <KpiCard icon={Star} label="Pending Reviews">
        <div className="font-display text-3xl">{count}</div>
        <div className="mt-1 text-xs text-muted-foreground">Awaiting reply</div>
      </KpiCard>
    </Link>
  );
}
function KpiNewCustomers({ count }: any) {
  return (
    <KpiCard icon={Users} label="New Customers">
      <div className="font-display text-3xl">{count}</div>
      <div className="mt-1 text-xs text-muted-foreground">This week</div>
    </KpiCard>
  );
}
function KpiRevenue() {
  return (
    <KpiCard icon={Wallet} label="Revenue">
      <div className="font-display text-3xl text-muted-foreground">—</div>
      <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">Coming soon</div>
    </KpiCard>
  );
}

function Perf({ icon: Icon, label, value, tone }: any) {
  const t: Record<string, string> = {
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    rose: "text-rose-400",
    zinc: "text-zinc-400",
    gold: "text-gold",
  };
  return (
    <div className="rounded-xl border border-hairline bg-background/40 p-3 text-center">
      <Icon className={cn("mx-auto size-4", t[tone])} />
      <div className="mt-1 font-display text-xl">{value}</div>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
    </div>
  );
}

function QuickActions({ onInvite }: { onInvite: () => void }) {
  const items = [
    { label: "Create Booking", icon: Plus, to: "/owner/bookings" as const },
    { label: "Add Service", icon: Sparkles, to: "/owner/services" as const },
    { label: "Edit Salon", icon: Store, to: "/owner/salon" as const },
    { label: "Open Calendar", icon: Calendar, to: "/owner/calendar" as const },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={onInvite}
        className="inline-flex items-center gap-2 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-gold-glow"
      >
        <UserPlus className="size-4" /> Invite Barber
      </button>
      {items.map((i) => (
        <Link
          key={i.label}
          to={i.to}
          className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface px-4 py-2 text-sm hover:border-gold/40"
        >
          <i.icon className="size-4" /> {i.label}
        </Link>
      ))}
    </div>
  );
}

// ---------------- invitations ----------------
function InviteRow({ invite }: { invite: any }) {
  const cancel = useServerFn(cancelInvite);
  const resend = useServerFn(resendInvite);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const link = useMemo(
    () => (typeof window !== "undefined" ? `${window.location.origin}/invite/${invite.token}` : ""),
    [invite.token],
  );
  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{invite.full_name || invite.email}</div>
        <div className="truncate text-xs text-muted-foreground">
          {invite.role} · sent {new Date(invite.created_at).toLocaleDateString()} · expires {new Date(invite.expires_at).toLocaleDateString()}
        </div>
      </div>
      <button
        onClick={() => { navigator.clipboard.writeText(link); }}
        className="inline-flex items-center gap-1 rounded-full border border-hairline px-3 py-1 text-xs hover:border-gold/40"
        title="Copy invitation link"
      >
        <Copy className="size-3" /> Copy
      </button>
      <button
        disabled={busy}
        onClick={async () => { setBusy(true); try { await resend({ data: { id: invite.id } }); await qc.invalidateQueries({ queryKey: ["owner", "dashboard"] }); } finally { setBusy(false); } }}
        className="inline-flex items-center gap-1 rounded-full border border-hairline px-3 py-1 text-xs hover:border-gold/40 disabled:opacity-50"
      >
        <RefreshCw className="size-3" /> Resend
      </button>
      <button
        disabled={busy}
        onClick={async () => { if (!confirm("Cancel this invitation?")) return; setBusy(true); try { await cancel({ data: { id: invite.id } }); await qc.invalidateQueries({ queryKey: ["owner", "dashboard"] }); } finally { setBusy(false); } }}
        className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 px-3 py-1 text-xs text-rose-400 hover:bg-rose-500/10 disabled:opacity-50"
      >
        <XIcon className="size-3" /> Cancel
      </button>
    </li>
  );
}

// ---------------- booking drawer ----------------
function BookingDrawer({ booking, onClose, onChanged }: { booking: any; onClose: () => void; onChanged: () => void }) {
  const setStatus = useServerFn(setBookingStatus);
  const [busy, setBusy] = useState(false);
  async function apply(status: any) {
    if (busy) return;
    setBusy(true);
    try {
      await setStatus({ data: { bookingId: booking.id, status } });
      onChanged();
    } catch (e: any) {
      alert(e?.message ?? "Failed to update booking");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-md flex-col border-s border-hairline bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-hairline px-5 py-4">
          <div>
            <div className="text-xs uppercase text-muted-foreground">Booking</div>
            <div className="font-display text-lg">#{booking.booking_ref}</div>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1 hover:bg-background"><XIcon className="size-5" /></button>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto p-5 text-sm">
          <div className="rounded-xl border border-hairline bg-background/40 p-4">
            <div className="text-xs uppercase text-muted-foreground">Customer</div>
            <div className="mt-1 font-medium">{booking.customer?.full_name ?? booking.customer?.email ?? "—"}</div>
            <div className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
              {booking.customer?.email && <span className="inline-flex items-center gap-2"><Mail className="size-3" />{booking.customer.email}</span>}
              {booking.customer?.phone && <span className="inline-flex items-center gap-2"><Phone className="size-3" />{booking.customer.phone}</span>}
            </div>
          </div>
          <Row label="Service" value={`${booking.service?.name_en ?? "—"} · ${booking.service?.duration_min ?? "—"} min`} />
          <Row label="Barber" value={booking.barber?.display_name_en ?? "—"} />
          <Row label="Time" value={`${fmtTime(booking.starts_at)} – ${fmtTime(booking.ends_at)}`} />
          <Row label="Price" value={`${Number(booking.price_sar).toFixed(2)} SAR`} />
          <Row label="Status" value={booking.status} />
          {booking.notes && (
            <div className="rounded-xl border border-hairline bg-background/40 p-4">
              <div className="text-xs uppercase text-muted-foreground">Notes</div>
              <p className="mt-1 whitespace-pre-wrap">{booking.notes}</p>
            </div>
          )}
        </div>
        <footer className="grid grid-cols-2 gap-2 border-t border-hairline p-4">
          <button disabled={busy} onClick={() => apply("confirmed")} className="rounded-xl bg-emerald-500/15 px-3 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-50">Confirm</button>
          <button disabled={busy} onClick={() => apply("completed")} className="rounded-xl bg-blue-500/15 px-3 py-2 text-sm font-medium text-blue-400 hover:bg-blue-500/25 disabled:opacity-50">Mark Completed</button>
          <button disabled={busy} onClick={() => apply("no_show")} className="rounded-xl bg-zinc-500/15 px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-500/25 disabled:opacity-50">No-show</button>
          <button disabled={busy} onClick={() => apply("cancelled")} className="rounded-xl bg-rose-500/15 px-3 py-2 text-sm font-medium text-rose-400 hover:bg-rose-500/25 disabled:opacity-50">Cancel</button>
        </footer>
      </aside>
    </div>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-hairline/40 pb-2">
      <span className="text-xs uppercase text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

// ---------------- invite drawer ----------------
function InviteBarberDrawer({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // delegate to existing barbers/new for richer flow if available; here we do quick create
  const { inviteBarberFromOwner } = require("@/lib/owner.functions");
  const fn = useServerFn(inviteBarberFromOwner);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      const inv = await fn({ data: { email, full_name: name || undefined, phone: phone || undefined } });
      const link = `${window.location.origin}/invite/${inv.token}`;
      await navigator.clipboard.writeText(link).catch(() => {});
      onDone();
      alert(`Invitation created. Link copied to clipboard:\n${link}`);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to send invitation");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <aside className="flex h-full w-full max-w-md flex-col border-s border-hairline bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-hairline px-5 py-4">
          <div className="font-display text-lg">Invite Barber</div>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-background"><XIcon className="size-5" /></button>
        </header>
        <form onSubmit={submit} className="flex-1 space-y-4 overflow-y-auto p-5 text-sm">
          <Field label="Email" required>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-hairline bg-background px-3 py-2 outline-none focus:border-gold/60" />
          </Field>
          <Field label="Full name">
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-hairline bg-background px-3 py-2 outline-none focus:border-gold/60" />
          </Field>
          <Field label="Phone">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-xl border border-hairline bg-background px-3 py-2 outline-none focus:border-gold/60" />
          </Field>
          {err && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">{err}</div>}
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-full border border-hairline px-4 py-2 text-sm">Cancel</button>
            <button disabled={busy} type="submit" className="rounded-full bg-gold px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-gold-glow disabled:opacity-50">
              {busy ? "Sending…" : "Send Invitation"}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
function Field({ label, required, children }: any) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase text-muted-foreground">{label}{required && " *"}</span>
      {children}
    </label>
  );
}
