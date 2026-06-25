import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listBarbers } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/barbers/")({
  component: BarbersPage,
});

function BarbersPage() {
  const list = useServerFn(listBarbers);
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["admin-barbers", search], queryFn: () => list({ data: { search } }) });

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div><h1 className="font-display text-3xl">Barbers</h1><p className="text-sm text-muted-foreground">All barbers across all salons.</p></div>
        <Link to="/admin/barbers/new" className="rounded-full bg-gold px-4 py-2 text-sm font-semibold text-primary-foreground">+ Invite Barber</Link>
      </div>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search barbers…" className="w-full max-w-md rounded-full border border-hairline bg-surface px-4 py-2 text-sm outline-none focus:border-gold/60" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {isLoading && <div className="text-muted-foreground">Loading…</div>}
        {(data ?? []).map((b: any) => (
          <Link key={b.id} to="/admin/barbers/$id" params={{ id: b.id }} className="block rounded-2xl border border-hairline bg-surface p-4 transition hover:border-gold/40">
            <div className="flex items-center gap-3">
              {b.photo_url ? <img src={b.photo_url} alt="" className="size-12 rounded-full object-cover" /> : <div className="size-12 rounded-full bg-background" />}
              <div className="min-w-0">
                <div className="truncate font-medium">{b.display_name_en}</div>
                <div className="truncate text-xs text-muted-foreground">{b.shops?.name_en ?? "—"}</div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>★ {b.rating_avg ? Number(b.rating_avg).toFixed(1) : "—"} ({b.rating_count ?? 0})</span>
              <span className={`rounded-full px-2 py-0.5 ${b.status === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>{b.status}</span>
            </div>
          </Link>
        ))}
        {!isLoading && (data?.length ?? 0) === 0 && <div className="text-muted-foreground">No barbers yet.</div>}
      </div>
    </div>
  );
}
