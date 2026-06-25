import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getProfileDetail, setProfileStatus } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/customers/$id")({
  component: CustomerDetailPage,
});

function CustomerDetailPage() {
  const { id } = useParams({ from: "/_authenticated/admin/customers/$id" });
  const fn = useServerFn(getProfileDetail);
  const setStatus = useServerFn(setProfileStatus);
  const { data, isLoading, refetch } = useQuery({ queryKey: ["admin-profile", id], queryFn: () => fn({ data: { id } }) });

  if (isLoading || !data) return <div className="text-muted-foreground">Loading…</div>;
  const p: any = data.profile;
  if (!p) return <div>Not found.</div>;
  const completed = data.bookings.filter((b: any) => b.status === "completed").length;
  const cancelled = data.bookings.filter((b: any) => b.status === "cancelled").length;
  const noShow = data.bookings.filter((b: any) => b.status === "no_show").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/admin/customers" className="text-xs text-muted-foreground hover:underline">← Customers</Link>
          <h1 className="font-display text-3xl">{p.full_name || p.email}</h1>
          <p className="text-sm text-muted-foreground">{p.email} · {p.phone ?? "no phone"}</p>
        </div>
        <button
          onClick={async () => { await setStatus({ data: { id: p.id, status: p.status === "active" ? "suspended" : "active" } }); refetch(); }}
          className="rounded-full border border-hairline px-4 py-2 text-sm">
          {p.status === "active" ? "Suspend" : "Restore"}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[["Status", p.status], ["Bookings", data.bookings.length], ["Completed", completed], ["Cancelled / No-show", `${cancelled} / ${noShow}`]].map(([k, v]) => (
          <div key={k as string} className="rounded-2xl border border-hairline bg-surface p-4">
            <div className="text-xs uppercase text-muted-foreground">{k}</div>
            <div className="mt-1 font-display text-2xl">{v as any}</div>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-hairline bg-surface p-5">
        <h2 className="mb-3 font-display text-lg">Profile</h2>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          {[["Created", new Date(p.created_at).toLocaleString()], ["Last login", p.last_login_at ? new Date(p.last_login_at).toLocaleString() : "—"], ["Nationality", p.nationality ?? "—"], ["Language", p.language ?? "—"], ["Roles", data.roles.join(", ") || "customer"], ["Notes", p.notes ?? "—"]].map(([k, v]) => (
            <div key={k as string}><dt className="text-xs uppercase text-muted-foreground">{k}</dt><dd>{v as any}</dd></div>
          ))}
        </dl>
      </section>

      <section className="rounded-2xl border border-hairline bg-surface p-5">
        <h2 className="mb-3 font-display text-lg">Bookings</h2>
        <div className="space-y-2 text-sm">
          {data.bookings.map((b: any) => (
            <div key={b.id} className="flex items-center justify-between border-b border-hairline/40 pb-2 last:border-0">
              <div><div className="font-medium">{b.booking_ref}</div><div className="text-xs text-muted-foreground">{b.shops?.name_en} · {new Date(b.starts_at).toLocaleString()}</div></div>
              <span className="text-xs">{b.status} · {b.price_sar} SAR</span>
            </div>
          ))}
          {data.bookings.length === 0 && <p className="text-muted-foreground">No bookings.</p>}
        </div>
      </section>

      <section className="rounded-2xl border border-hairline bg-surface p-5">
        <h2 className="mb-3 font-display text-lg">Reviews</h2>
        {data.reviews.map((r: any) => (
          <div key={r.id} className="border-b border-hairline/40 py-2 text-sm last:border-0">
            <span className="text-gold">{"★".repeat(Math.round(Number(r.rating)))}</span>{" "}
            <span className="text-xs text-muted-foreground">{r.shops?.name_en} · {new Date(r.created_at).toLocaleDateString()}</span>
            {r.comment && <p>{r.comment}</p>}
          </div>
        ))}
        {data.reviews.length === 0 && <p className="text-sm text-muted-foreground">No reviews.</p>}
      </section>

      <section className="rounded-2xl border border-hairline bg-surface p-5">
        <h2 className="mb-3 font-display text-lg">Favorites ({data.favorites.length})</h2>
      </section>
    </div>
  );
}
