import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getAdminMetrics } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const fn = useServerFn(getAdminMetrics);
  const { data } = useQuery({ queryKey: ["admin-metrics-reports"], queryFn: () => fn() });
  if (!data) return <div className="text-muted-foreground">Loading reports…</div>;
  const t = data.totals;
  const rows = [
    ["Total Salons", t.salons], ["Active Salons", t.activeSalons],
    ["Total Owners", t.owners], ["Total Barbers", t.barbers], ["Total Customers", t.customers],
    ["Total Bookings", t.bookings], ["Bookings Today", t.bookingsToday],
    ["Completed Bookings", t.bookingsCompleted], ["Cancelled Bookings", t.bookingsCancelled],
    ["Pending Bookings", t.bookingsPending],
    ["New Customers (7d)", t.newUsersThisWeek],
    ["Average Rating", t.averageRating || "—"],
  ];
  return (
    <div className="space-y-4">
      <div><h1 className="font-display text-3xl">Reports & Analytics</h1><p className="text-sm text-muted-foreground">Platform-wide metrics.</p></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(([k,v]) => (
          <div key={k as string} className="rounded-2xl border border-hairline bg-surface p-4">
            <div className="text-xs uppercase text-muted-foreground">{k}</div>
            <div className="mt-2 font-display text-2xl">{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
