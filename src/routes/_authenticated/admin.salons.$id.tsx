import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getSalon, updateSalon } from "@/lib/admin.functions";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/_authenticated/admin/salons/$id")({
  component: SalonDetailPage,
});

const input = "w-full rounded-2xl border border-hairline bg-background px-4 py-2.5 text-sm outline-none focus:border-gold/60";

function SalonDetailPage() {
  const { id } = useParams({ from: "/_authenticated/admin/salons/$id" });
  const fn = useServerFn(getSalon);
  const upd = useServerFn(updateSalon);
  const { data, isLoading, refetch } = useQuery({ queryKey: ["admin-salon", id], queryFn: () => fn({ data: { id } }) });
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (data?.shop) setForm({ ...data.shop }); }, [data]);

  if (isLoading || !data || !data.shop || !form) return <div className="text-muted-foreground">Loading…</div>;

  async function save() {
    setSaving(true);
    try {
      const patch: any = {};
      const keys = ["name_en","name_ar","description_en","description_ar","phone","whatsapp","email","website","city","district","address","logo_url","cover_url","featured","booking_enabled","walkin_enabled","accept_reviews","max_booking_window_days","booking_interval_minutes"];
      for (const k of keys) patch[k] = form[k];
      await upd({ data: { id, patch } });
      await refetch();
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/_authenticated/admin/salons" className="text-xs text-muted-foreground hover:underline">← Salons</Link>
          <h1 className="font-display text-3xl">{data.shop.name_en}</h1>
          <p className="text-sm text-muted-foreground">{data.shop.slug}</p>
        </div>
        <button onClick={save} disabled={saving} className="rounded-full bg-gold px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">{saving ? "Saving…" : "Save Changes"}</button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-hairline bg-surface p-4">
          <div className="text-xs uppercase text-muted-foreground">Barbers</div>
          <div className="mt-2 font-display text-2xl">{data.barbers.length}</div>
        </div>
        <div className="rounded-2xl border border-hairline bg-surface p-4">
          <div className="text-xs uppercase text-muted-foreground">Recent Bookings</div>
          <div className="mt-2 font-display text-2xl">{data.bookings.length}</div>
        </div>
        <div className="rounded-2xl border border-hairline bg-surface p-4">
          <div className="text-xs uppercase text-muted-foreground">Reviews</div>
          <div className="mt-2 font-display text-2xl">{data.reviews.length}</div>
        </div>
      </div>

      <section className="space-y-4 rounded-2xl border border-hairline bg-surface p-5">
        <h2 className="font-display text-lg">General Information</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ["name_en","Name (EN)"],["name_ar","Name (AR)"],
            ["phone","Phone"],["whatsapp","WhatsApp"],
            ["email","Email"],["website","Website"],
            ["city","City"],["district","District"],
            ["logo_url","Logo URL"],["cover_url","Cover URL"],
          ].map(([k,l]) => (
            <label key={k} className="block">
              <span className="text-xs font-medium text-muted-foreground">{l}</span>
              <input className={input + " mt-1.5"} value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-hairline bg-surface p-5">
        <h2 className="font-display text-lg">Settings</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {[["featured","Featured"],["booking_enabled","Booking Enabled"],["walkin_enabled","Walk-ins"],["accept_reviews","Accept Reviews"]].map(([k,l]) => (
            <label key={k} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.checked })} />{l}
            </label>
          ))}
          <label className="block"><span className="text-xs font-medium text-muted-foreground">Max booking window (days)</span>
            <input type="number" className={input + " mt-1.5"} value={form.max_booking_window_days ?? 30} onChange={(e) => setForm({ ...form, max_booking_window_days: Number(e.target.value) })} />
          </label>
          <label className="block"><span className="text-xs font-medium text-muted-foreground">Booking interval (min)</span>
            <select className={input + " mt-1.5"} value={form.booking_interval_minutes ?? 30} onChange={(e) => setForm({ ...form, booking_interval_minutes: Number(e.target.value) })}>
              {[15,20,30,45,60].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-hairline bg-surface p-5">
        <h2 className="mb-3 font-display text-lg">Barbers ({data.barbers.length})</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.barbers.map((b: any) => (
            <div key={b.id} className="flex items-center gap-3 rounded-xl border border-hairline/60 p-3">
              {b.avatar_url ? <img src={b.avatar_url} alt="" className="size-10 rounded-full object-cover" /> : <div className="size-10 rounded-full bg-background" />}
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{b.display_name_en}</div>
                <div className="truncate text-xs text-muted-foreground">{b.status}</div>
              </div>
            </div>
          ))}
          {data.barbers.length === 0 && <p className="text-sm text-muted-foreground">No barbers yet.</p>}
        </div>
      </section>

      <section className="rounded-2xl border border-hairline bg-surface p-5">
        <h2 className="mb-3 font-display text-lg">Recent Bookings</h2>
        <div className="space-y-2 text-sm">
          {data.bookings.map((b: any) => (
            <div key={b.id} className="flex items-center justify-between border-b border-hairline/40 pb-2 last:border-0">
              <div>
                <div className="font-medium">{b.booking_ref}</div>
                <div className="text-xs text-muted-foreground">{new Date(b.starts_at).toLocaleString()}</div>
              </div>
              <span className="text-xs">{b.status} · {b.price_sar} SAR</span>
            </div>
          ))}
          {data.bookings.length === 0 && <p className="text-muted-foreground">No bookings yet.</p>}
        </div>
      </section>
    </div>
  );
}
