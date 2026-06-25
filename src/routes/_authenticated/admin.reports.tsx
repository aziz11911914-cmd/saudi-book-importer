import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getAdminMetrics, getReports } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const m = useServerFn(getAdminMetrics);
  const r = useServerFn(getReports);
  const { data: metrics } = useQuery({ queryKey: ["admin-metrics-reports"], queryFn: () => m() });
  const { data: rep } = useQuery({ queryKey: ["admin-reports"], queryFn: () => r() });

  if (!metrics || !rep) return <div className="text-muted-foreground">Loading reports…</div>;
  const t = metrics.totals;
  const rows = [
    ["Total Salons", t.salons], ["Active Salons", t.activeSalons],
    ["Total Owners", t.owners], ["Total Barbers", t.barbers], ["Total Customers", t.customers],
    ["Total Bookings", t.bookings], ["Bookings Today", t.bookingsToday],
    ["Bookings This Week", rep.bookingsThisWeek], ["Bookings This Month", rep.bookingsThisMonth],
    ["Completed", t.bookingsCompleted], ["Cancelled", t.bookingsCancelled],
    ["Pending", t.bookingsPending], ["No-show", rep.bookingsNoShow],
    ["New Customers (30d)", rep.newCustomers30d],
    ["Growth Rate", rep.growthRatePct === null ? "—" : `${rep.growthRatePct.toFixed(1)}%`],
    ["Average Rating", t.averageRating || "—"],
  ];

  return (
    <div className="space-y-6">
      <div><h1 className="font-display text-3xl">Reports & Analytics</h1><p className="text-sm text-muted-foreground">Platform-wide metrics.</p></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map(([k, v]) => (
          <div key={k as string} className="rounded-2xl border border-hairline bg-surface p-4">
            <div className="text-xs uppercase text-muted-foreground">{k}</div>
            <div className="mt-2 font-display text-2xl">{v as any}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <TopList title="Most Popular Salons" rows={rep.topShops} />
        <TopList title="Most Popular Barbers" rows={rep.topBarbers} />
        <TopList title="Most Popular Haircuts" rows={rep.topServices} />
      </div>
    </div>
  );
}

function TopList({ title, rows }: { title: string; rows: { id: string; label: string; count: number }[] }) {
  return (
    <section className="rounded-2xl border border-hairline bg-surface p-5">
      <h2 className="mb-3 font-display text-lg">{title}</h2>
      <ol className="space-y-1.5 text-sm">
        {rows.map((r, i) => (
          <li key={r.id} className="flex items-center justify-between">
            <span><span className="me-2 text-muted-foreground">{i + 1}.</span>{r.label}</span>
            <span className="text-xs text-muted-foreground">{r.count}</span>
          </li>
        ))}
        {rows.length === 0 && <li className="text-muted-foreground">No data yet.</li>}
      </ol>
    </section>
  );
}
