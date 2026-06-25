import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getAdminMetrics } from "@/lib/admin.functions";
import { Store, Users, Scissors, UserCircle, CalendarCheck, Star, Clock, CheckCircle2, XCircle, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
});

function StatCard({ icon: Icon, label, value, accent = false }: { icon: any; label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-hairline bg-surface p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase text-muted-foreground">{label}</span>
        <Icon className={`size-4 ${accent ? "text-gold" : "text-muted-foreground"}`} />
      </div>
      <div className="mt-3 font-display text-3xl">{value}</div>
    </div>
  );
}

function AdminDashboard() {
  const fn = useServerFn(getAdminMetrics);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-metrics"],
    queryFn: () => fn(),
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });

  if (isLoading || !data) return <div className="text-muted-foreground">Loading dashboard…</div>;
  const t = data.totals;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Platform overview at a glance.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Store} label="Total Salons" value={t.salons} accent />
        <StatCard icon={UserCircle} label="Owners" value={t.owners} />
        <StatCard icon={Scissors} label="Barbers" value={t.barbers} />
        <StatCard icon={Users} label="Customers" value={t.customers} />
        <StatCard icon={CalendarCheck} label="Bookings Today" value={t.bookingsToday} accent />
        <StatCard icon={Clock} label="Pending Bookings" value={t.bookingsPending} />
        <StatCard icon={CheckCircle2} label="Completed" value={t.bookingsCompleted} />
        <StatCard icon={XCircle} label="Cancelled" value={t.bookingsCancelled} />
        <StatCard icon={TrendingUp} label="New Users / 7d" value={t.newUsersThisWeek} />
        <StatCard icon={Star} label="Average Rating" value={t.averageRating || "—"} accent />
        <StatCard icon={Store} label="Active Salons" value={t.activeSalons} />
        <StatCard icon={CalendarCheck} label="Total Bookings" value={t.bookings} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-hairline bg-surface p-5">
          <h2 className="mb-3 font-display text-lg">Recent Activity</h2>
          {data.recentActivity.length === 0 && <p className="text-sm text-muted-foreground">No activity yet.</p>}
          <ul className="space-y-2 text-sm">
            {data.recentActivity.map((a: any) => (
              <li key={a.id} className="flex items-start justify-between gap-3 border-b border-hairline/40 pb-2 last:border-0">
                <div>
                  <div className="font-medium">{a.action}</div>
                  <div className="text-xs text-muted-foreground">{a.actor_email ?? "system"} · {a.target_type ?? ""}</div>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-hairline bg-surface p-5">
          <h2 className="mb-3 font-display text-lg">Recent Reviews</h2>
          {data.recentReviews.length === 0 && <p className="text-sm text-muted-foreground">No reviews yet.</p>}
          <ul className="space-y-3 text-sm">
            {data.recentReviews.map((r: any) => (
              <li key={r.id} className="border-b border-hairline/40 pb-2 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-gold">{"★".repeat(Math.round(Number(r.rating)))}</span>
                  <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                {r.comment && <p className="mt-1 text-muted-foreground">{r.comment}</p>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
