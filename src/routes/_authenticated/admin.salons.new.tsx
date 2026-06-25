import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { createSalon } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/salons/new")({
  component: NewSalonPage,
});

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

const input = "w-full rounded-2xl border border-hairline bg-background px-4 py-2.5 text-sm outline-none focus:border-gold/60";

function NewSalonPage() {
  const fn = useServerFn(createSalon);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    name_en: "", name_ar: "", slug: "",
    description_en: "", description_ar: "",
    phone: "", whatsapp: "", email: "", website: "",
    city: "", district: "", address: "",
    lat: "", lng: "",
    logo_url: "", cover_url: "",
    featured: false, booking_enabled: true, walkin_enabled: false, accept_reviews: true,
    max_booking_window_days: 30, booking_interval_minutes: 30,
  });

  function set<K extends keyof typeof form>(k: K, v: any) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      const payload: any = { ...form };
      payload.lat = form.lat ? Number(form.lat) : null;
      payload.lng = form.lng ? Number(form.lng) : null;
      for (const k of ["description_en","description_ar","phone","whatsapp","email","website","city","district","address","logo_url","cover_url"]) {
        if (payload[k] === "") payload[k] = null;
      }
      const row = await fn({ data: payload });
      navigate({ to: "/admin/salons/$id" as any, params: { id: row.id } as any });
    } catch (e: any) {
      setErr(e?.message ?? "Failed");
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl">Create Salon</h1>
        <p className="text-sm text-muted-foreground">Set up the salon profile and configuration.</p>
      </div>

      <section className="space-y-4 rounded-2xl border border-hairline bg-surface p-5">
        <h2 className="font-display text-lg">Salon Information</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name (English)"><input required className={input} value={form.name_en} onChange={(e) => set("name_en", e.target.value)} /></Field>
          <Field label="Name (Arabic)"><input required className={input} value={form.name_ar} onChange={(e) => set("name_ar", e.target.value)} /></Field>
          <Field label="Slug (URL-safe)"><input required className={input} value={form.slug} onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} /></Field>
          <Field label="Phone"><input className={input} value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
          <Field label="WhatsApp"><input className={input} value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} /></Field>
          <Field label="Email"><input type="email" className={input} value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="Website"><input className={input} value={form.website} onChange={(e) => set("website", e.target.value)} /></Field>
          <Field label="Logo URL"><input className={input} value={form.logo_url} onChange={(e) => set("logo_url", e.target.value)} /></Field>
          <Field label="Cover URL"><input className={input} value={form.cover_url} onChange={(e) => set("cover_url", e.target.value)} /></Field>
        </div>
        <Field label="Description (EN)"><textarea rows={2} className={input} value={form.description_en} onChange={(e) => set("description_en", e.target.value)} /></Field>
        <Field label="Description (AR)"><textarea rows={2} className={input} value={form.description_ar} onChange={(e) => set("description_ar", e.target.value)} /></Field>
      </section>

      <section className="space-y-4 rounded-2xl border border-hairline bg-surface p-5">
        <h2 className="font-display text-lg">Location</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="City"><input className={input} value={form.city} onChange={(e) => set("city", e.target.value)} /></Field>
          <Field label="District"><input className={input} value={form.district} onChange={(e) => set("district", e.target.value)} /></Field>
          <Field label="Address"><input className={input} value={form.address} onChange={(e) => set("address", e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude"><input className={input} value={form.lat} onChange={(e) => set("lat", e.target.value)} /></Field>
            <Field label="Longitude"><input className={input} value={form.lng} onChange={(e) => set("lng", e.target.value)} /></Field>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-hairline bg-surface p-5">
        <h2 className="font-display text-lg">Settings</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ["featured", "Featured"], ["booking_enabled", "Booking Enabled"],
            ["walkin_enabled", "Walk-ins Enabled"], ["accept_reviews", "Accept Reviews"],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={(form as any)[key]} onChange={(e) => set(key as any, e.target.checked)} />
              {label}
            </label>
          ))}
          <Field label="Max booking window (days)"><input type="number" min={1} max={365} className={input} value={form.max_booking_window_days} onChange={(e) => set("max_booking_window_days", Number(e.target.value))} /></Field>
          <Field label="Booking interval (minutes)"><select className={input} value={form.booking_interval_minutes} onChange={(e) => set("booking_interval_minutes", Number(e.target.value))}>
            {[15,20,30,45,60].map((n) => <option key={n} value={n}>{n}</option>)}
          </select></Field>
        </div>
      </section>

      {err && <div className="rounded-2xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-300">{err}</div>}

      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => navigate({ to: "/admin/salons" as any })} className="rounded-full border border-hairline px-5 py-2 text-sm">Cancel</button>
        <button type="submit" disabled={busy} className="rounded-full bg-gold px-6 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">{busy ? "Creating…" : "Create Salon"}</button>
      </div>
    </form>
  );
}
