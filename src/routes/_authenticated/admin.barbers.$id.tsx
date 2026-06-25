import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getBarberDetail, updateBarber } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/barbers/$id")({
  component: BarberDetailPage,
});

const input = "w-full rounded-2xl border border-hairline bg-background px-4 py-2.5 text-sm outline-none focus:border-gold/60";

function BarberDetailPage() {
  const { id } = useParams({ from: "/_authenticated/admin/barbers/$id" });
  const fn = useServerFn(getBarberDetail);
  const upd = useServerFn(updateBarber);
  const { data, isLoading, refetch } = useQuery({ queryKey: ["admin-barber", id], queryFn: () => fn({ data: { id } }) });
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (data?.barber) setForm({ ...data.barber }); }, [data]);

  if (isLoading || !data || !data.barber || !form) return <div className="text-muted-foreground">Loading…</div>;

  async function save() {
    setSaving(true);
    try {
      const keys = ["display_name_en","display_name_ar","photo_url","bio_en","bio_ar","years_experience","status","featured"];
      const patch: any = {}; for (const k of keys) patch[k] = form[k];
      await upd({ data: { id, patch } });
      await refetch();
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/admin/barbers" className="text-xs text-muted-foreground hover:underline">← Barbers</Link>
          <h1 className="font-display text-3xl">{data.barber.display_name_en}</h1>
          <p className="text-sm text-muted-foreground">{data.barber.shops?.name_en ?? "Unassigned"}</p>
        </div>
        <button onClick={save} disabled={saving} className="rounded-full bg-gold px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">{saving ? "Saving…" : "Save"}</button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[["Status", form.status], ["Rating", `${data.barber.rating_avg ?? 0} (${data.barber.rating_count ?? 0})`], ["Services", data.services.length], ["Portfolio", data.portfolio.length]].map(([k, v]) => (
          <div key={k as string} className="rounded-2xl border border-hairline bg-surface p-4">
            <div className="text-xs uppercase text-muted-foreground">{k}</div>
            <div className="mt-1 font-display text-2xl">{v as any}</div>
          </div>
        ))}
      </div>

      <section className="space-y-3 rounded-2xl border border-hairline bg-surface p-5">
        <h2 className="font-display text-lg">Profile</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {[["display_name_en","Name (EN)"],["display_name_ar","Name (AR)"],["photo_url","Photo URL"],["years_experience","Years experience"],["bio_en","Bio (EN)"],["bio_ar","Bio (AR)"]].map(([k,l]) => (
            <label key={k} className="block">
              <span className="text-xs font-medium text-muted-foreground">{l}</span>
              <input className={input + " mt-1.5"} value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: k === "years_experience" ? Number(e.target.value) : e.target.value })} />
            </label>
          ))}
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Status</span>
            <select className={input + " mt-1.5"} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="active">active</option><option value="inactive">inactive</option><option value="suspended">suspended</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm mt-6">
            <input type="checkbox" checked={!!form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} /> Featured
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-hairline bg-surface p-5">
        <h2 className="mb-3 font-display text-lg">Services</h2>
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          {data.services.map((s: any) => <li key={s.service_id} className="flex justify-between rounded-xl border border-hairline/60 p-3"><span>{s.services?.name_en}</span><span className="text-muted-foreground">{s.services?.price_sar} SAR · {s.services?.duration_minutes}m</span></li>)}
        </ul>
        {data.services.length === 0 && <p className="text-sm text-muted-foreground">No services.</p>}
      </section>

      <section className="rounded-2xl border border-hairline bg-surface p-5">
        <h2 className="mb-3 font-display text-lg">Portfolio</h2>
        <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
          {data.portfolio.map((p: any) => <img key={p.id} src={p.url} alt={p.title_en ?? ""} className="aspect-square rounded-xl object-cover" loading="lazy" />)}
        </div>
        {data.portfolio.length === 0 && <p className="text-sm text-muted-foreground">No portfolio yet.</p>}
      </section>

      <section className="rounded-2xl border border-hairline bg-surface p-5">
        <h2 className="mb-3 font-display text-lg">Recent Reviews</h2>
        {data.reviews.map((r: any) => (
          <div key={r.id} className="border-b border-hairline/40 py-2 text-sm last:border-0">
            <span className="text-gold">{"★".repeat(Math.round(Number(r.rating)))}</span>
            <span className="ms-2 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
            {r.comment && <p>{r.comment}</p>}
          </div>
        ))}
        {data.reviews.length === 0 && <p className="text-sm text-muted-foreground">No reviews.</p>}
      </section>
    </div>
  );
}
