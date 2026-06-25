import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listAllBookings } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/bookings")({
  component: BookingsPage,
});

const STATUSES = ["", "pending", "confirmed", "completed", "cancelled", "no_show", "rejected"];

function BookingsPage() {
  const list = useServerFn(listAllBookings);
  const [status, setStatus] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["admin-bookings", status], queryFn: () => list({ data: { status: status || undefined } }) });

  return (
    <div className="space-y-4">
      <div><h1 className="font-display text-3xl">Bookings</h1><p className="text-sm text-muted-foreground">All bookings across the platform.</p></div>
      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={`rounded-full border px-3 py-1 text-xs ${status === s ? "border-gold bg-gold/10 text-gold" : "border-hairline text-muted-foreground"}`}>{s || "All"}</button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-hairline bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-background/40 text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-3 text-start">Ref</th><th className="px-4 py-3 text-start">Salon</th><th className="px-4 py-3 text-start">Barber</th><th className="px-4 py-3 text-start">Service</th><th className="px-4 py-3 text-start">When</th><th className="px-4 py-3 text-start">Price</th><th className="px-4 py-3 text-start">Status</th></tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>}
            {(data ?? []).map((b: any) => (
              <tr key={b.id} className="border-t border-hairline/40">
                <td className="px-4 py-3 font-mono text-xs">{b.booking_ref}</td>
                <td className="px-4 py-3">{b.shops?.name_en ?? "—"}</td>
                <td className="px-4 py-3">{b.barbers?.display_name_en ?? "—"}</td>
                <td className="px-4 py-3">{b.services?.name_en ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(b.starts_at).toLocaleString()}</td>
                <td className="px-4 py-3">{b.price_sar} SAR</td>
                <td className="px-4 py-3"><span className="rounded-full bg-gold/10 px-2 py-0.5 text-xs text-gold">{b.status}</span></td>
              </tr>
            ))}
            {!isLoading && (data?.length ?? 0) === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No bookings.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
