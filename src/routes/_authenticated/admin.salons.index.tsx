import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listSalons, setSalonStatus, deleteSalon } from "@/lib/admin.functions";
import { Plus, MoreVertical } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/salons/")({
  component: SalonsPage,
});

function SalonsPage() {
  const list = useServerFn(listSalons);
  const setStatus = useServerFn(setSalonStatus);
  const del = useServerFn(deleteSalon);
  const [search, setSearch] = useState("");
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-salons", search],
    queryFn: () => list({ data: { search } }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Salons</h1>
          <p className="text-sm text-muted-foreground">Manage all salons on the platform.</p>
        </div>
        <Link to="/_authenticated/admin/salons/new" className="inline-flex items-center gap-2 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-primary-foreground">
          <Plus className="size-4" /> Create Salon
        </Link>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or city…"
        className="w-full max-w-md rounded-full border border-hairline bg-surface px-4 py-2 text-sm outline-none focus:border-gold/60"
      />

      <div className="overflow-x-auto rounded-2xl border border-hairline bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-background/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-start">Salon</th>
              <th className="px-4 py-3 text-start">City</th>
              <th className="px-4 py-3 text-start">Status</th>
              <th className="px-4 py-3 text-start">Rating</th>
              <th className="px-4 py-3 text-start">Created</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>}
            {!isLoading && (data?.length ?? 0) === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No salons yet.</td></tr>}
            {(data ?? []).map((s: any) => (
              <tr key={s.id} className="border-t border-hairline/40">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {s.logo_url ? <img src={s.logo_url} alt="" className="size-9 rounded-full object-cover" /> : <div className="size-9 rounded-full bg-background" />}
                    <div>
                      <div className="font-medium">{s.name_en}</div>
                      <div className="text-xs text-muted-foreground">{s.name_ar}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{s.city ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${s.status === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                    {s.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{s.rating_avg ? `★ ${Number(s.rating_avg).toFixed(1)} (${s.rating_count})` : "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <RowMenu
                    salonId={s.id}
                    status={s.status}
                    onAction={async (action) => {
                      if (action === "suspend") await setStatus({ data: { id: s.id, status: "inactive" } });
                      else if (action === "activate") await setStatus({ data: { id: s.id, status: "active" } });
                      else if (action === "delete") { if (!confirm("Delete this salon?")) return; await del({ data: { id: s.id } }); }
                      refetch();
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RowMenu({ salonId, status, onAction }: { salonId: string; status: string; onAction: (a: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button onClick={() => setOpen((v) => !v)} className="rounded-lg p-1 hover:bg-background"><MoreVertical className="size-4" /></button>
      {open && (
        <div className="absolute end-0 z-10 mt-1 w-40 overflow-hidden rounded-xl border border-hairline bg-surface shadow-xl">
          <Link to="/_authenticated/admin/salons/$id" params={{ id: salonId }} className="block px-3 py-2 text-sm hover:bg-background">View / Edit</Link>
          {status === "active" ? (
            <button onClick={() => { setOpen(false); onAction("suspend"); }} className="block w-full px-3 py-2 text-start text-sm hover:bg-background">Suspend</button>
          ) : (
            <button onClick={() => { setOpen(false); onAction("activate"); }} className="block w-full px-3 py-2 text-start text-sm hover:bg-background">Activate</button>
          )}
          <button onClick={() => { setOpen(false); onAction("delete"); }} className="block w-full px-3 py-2 text-start text-sm text-red-400 hover:bg-background">Delete</button>
        </div>
      )}
    </div>
  );
}
