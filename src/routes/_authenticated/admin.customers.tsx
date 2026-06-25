import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listCustomers, setProfileStatus } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/customers")({
  component: CustomersPage,
});

function CustomersPage() {
  const list = useServerFn(listCustomers);
  const setStatus = useServerFn(setProfileStatus);
  const [search, setSearch] = useState("");
  const { data, isLoading, refetch } = useQuery({ queryKey: ["admin-customers", search], queryFn: () => list({ data: { search } }) });

  return (
    <div className="space-y-4">
      <div><h1 className="font-display text-3xl">Customers</h1><p className="text-sm text-muted-foreground">All registered customers.</p></div>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="w-full max-w-md rounded-full border border-hairline bg-surface px-4 py-2 text-sm outline-none focus:border-gold/60" />
      <div className="overflow-x-auto rounded-2xl border border-hairline bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-background/40 text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-3 text-start">Name</th><th className="px-4 py-3 text-start">Email</th><th className="px-4 py-3 text-start">Phone</th><th className="px-4 py-3 text-start">Status</th><th className="px-4 py-3 text-start">Joined</th><th className="px-4 py-3"></th></tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>}
            {(data ?? []).map((c: any) => (
              <tr key={c.id} className="border-t border-hairline/40">
                <td className="px-4 py-3">{c.full_name || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.email}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.phone ?? "—"}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs ${c.status === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>{c.status}</span></td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-end">
                  <button onClick={async () => { await setStatus({ data: { id: c.id, status: c.status === "active" ? "suspended" : "active" } }); refetch(); }} className="rounded-lg border border-hairline px-3 py-1 text-xs">{c.status === "active" ? "Suspend" : "Restore"}</button>
                </td>
              </tr>
            ))}
            {!isLoading && (data?.length ?? 0) === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No customers.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
