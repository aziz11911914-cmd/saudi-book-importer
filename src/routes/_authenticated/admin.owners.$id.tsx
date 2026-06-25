import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getProfileDetail, setProfileStatus } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/owners/$id")({
  component: OwnerDetailPage,
});

function OwnerDetailPage() {
  const { id } = useParams({ from: "/_authenticated/admin/owners/$id" });
  const fn = useServerFn(getProfileDetail);
  const setStatus = useServerFn(setProfileStatus);
  const { data, isLoading, refetch } = useQuery({ queryKey: ["admin-profile", id], queryFn: () => fn({ data: { id } }) });

  if (isLoading || !data || !data.profile) return <div className="text-muted-foreground">Loading…</div>;
  const p: any = data.profile;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/admin/owners" className="text-xs text-muted-foreground hover:underline">← Owners</Link>
          <h1 className="font-display text-3xl">{p.full_name || p.email}</h1>
          <p className="text-sm text-muted-foreground">{p.email}</p>
        </div>
        <button onClick={async () => { await setStatus({ data: { id: p.id, status: p.status === "active" ? "suspended" : "active" } }); refetch(); }} className="rounded-full border border-hairline px-4 py-2 text-sm">{p.status === "active" ? "Suspend" : "Restore"}</button>
      </div>

      <section className="rounded-2xl border border-hairline bg-surface p-5">
        <h2 className="mb-3 font-display text-lg">Personal Information</h2>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          {[["Status", p.status], ["Created", new Date(p.created_at).toLocaleString()], ["Last login", p.last_login_at ? new Date(p.last_login_at).toLocaleString() : "—"], ["Phone", p.phone ?? "—"], ["Nationality", p.nationality ?? "—"], ["Language", p.language ?? "—"]].map(([k, v]) => (
            <div key={k as string}><dt className="text-xs uppercase text-muted-foreground">{k}</dt><dd>{v as any}</dd></div>
          ))}
        </dl>
      </section>

      <section className="rounded-2xl border border-hairline bg-surface p-5">
        <h2 className="mb-3 font-display text-lg">Assigned Salon</h2>
        {data.ownerShop ? (
          <Link to="/admin/salons/$id" params={{ id: data.ownerShop.id }} className="inline-flex items-center justify-between rounded-xl border border-hairline px-3 py-2 text-sm hover:bg-background">
            <span>{(data.ownerShop as any).name_en}</span><span className="text-xs text-muted-foreground">{(data.ownerShop as any).status}</span>
          </Link>
        ) : <p className="text-sm text-muted-foreground">No salon assigned. Use the salon list and set the owner there.</p>}
      </section>
    </div>
  );
}
