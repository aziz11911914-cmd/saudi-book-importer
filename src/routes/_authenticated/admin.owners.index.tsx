import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listOwners, setProfileStatus } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/owners/")({
  component: OwnersPage,
});

function OwnersPage() {
  const list = useServerFn(listOwners);
  const setStatus = useServerFn(setProfileStatus);
  const [search, setSearch] = useState("");
  const { data, isLoading, refetch } = useQuery({ queryKey: ["admin-owners", search], queryFn: () => list({ data: { search } }) });

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div><h1 className="font-display text-3xl">Owners</h1><p className="text-sm text-muted-foreground">Salon owners and their assignments.</p></div>
        <Link to="/admin/owners/new" className="rounded-full bg-gold px-4 py-2 text-sm font-semibold text-primary-foreground">+ Invite Owner</Link>
      </div>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="w-full max-w-md rounded-full border border-hairline bg-surface px-4 py-2 text-sm outline-none focus:border-gold/60" />
      <div className="overflow-x-auto rounded-2xl border border-hairline bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-background/40 text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-3 text-start">Name</th><th className="px-4 py-3 text-start">Salon</th><th className="px-4 py-3 text-start">Phone</th><th className="px-4 py-3 text-start">Email</th><th className="px-4 py-3 text-start">Status</th><th className="px-4 py-3 text-start">Last login</th><th className="px-4 py-3"></th></tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>}
            {!isLoading && (data?.length ?? 0) === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No owners yet. Use “Invite Owner” to add one.</td></tr>}
            {(data ?? []).map((o: any) => (
              <tr key={o.id} className="border-t border-hairline/40">
                <td className="px-4 py-3"><Link to="/admin/owners/$id" params={{ id: o.id }} className="hover:underline">{o.full_name || `${o.first_name ?? ""} ${o.last_name ?? ""}`.trim() || o.email}</Link></td>
                <td className="px-4 py-3 text-muted-foreground">{o.shop?.name_en ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{o.phone ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{o.email}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs ${o.status === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>{o.status}</span></td>
                <td className="px-4 py-3 text-muted-foreground">{o.last_login_at ? new Date(o.last_login_at).toLocaleDateString() : "—"}</td>
                <td className="px-4 py-3 text-end">
                  <button onClick={async () => { await setStatus({ data: { id: o.id, status: o.status === "active" ? "suspended" : "active" } }); refetch(); }} className="rounded-lg border border-hairline px-3 py-1 text-xs">{o.status === "active" ? "Suspend" : "Activate"}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

