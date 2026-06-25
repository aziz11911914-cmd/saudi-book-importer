import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { createSalon } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/salons/new")({
  component: NewSalonPage,
});

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint ? <span className="mt-1 block text-[11px] text-muted-foreground/70">{hint}</span> : null}
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
    name_ar: "", name_en: "",
    city: "", district: "",
    phone: "", email: "",
    logo_url: "",
  });

  function set<K extends keyof typeof form>(k: K, v: any) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      const row = await fn({ data: form as any });
      navigate({ to: "/admin/salons/$id" as any, params: { id: row.id } as any });
    } catch (e: any) {
      setErr(e?.message ?? "Failed");
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl">Create Salon</h1>
        <p className="text-sm text-muted-foreground">
          Only the basics. The salon owner will complete the rest from the Owner Dashboard.
        </p>
      </div>

      <section className="space-y-4 rounded-2xl border border-hairline bg-surface p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Arabic Name *">
            <input required dir="rtl" className={input} value={form.name_ar} onChange={(e) => set("name_ar", e.target.value)} />
          </Field>
          <Field label="English Name" hint="Optional. Used for the URL slug.">
            <input className={input} value={form.name_en} onChange={(e) => set("name_en", e.target.value)} />
          </Field>
          <Field label="City">
            <input className={input} value={form.city} onChange={(e) => set("city", e.target.value)} />
          </Field>
          <Field label="District">
            <input className={input} value={form.district} onChange={(e) => set("district", e.target.value)} />
          </Field>
          <Field label="Phone">
            <input className={input} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </Field>
          <Field label="Email">
            <input type="email" className={input} value={form.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
        </div>
        <Field label="Logo URL" hint="Paste a hosted image URL. The owner can replace it later.">
          <input className={input} value={form.logo_url} onChange={(e) => set("logo_url", e.target.value)} />
        </Field>
      </section>

      {err && <div className="rounded-2xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-300">{err}</div>}

      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => navigate({ to: "/admin/salons" as any })} className="rounded-full border border-hairline px-5 py-2 text-sm">Cancel</button>
        <button type="submit" disabled={busy} className="rounded-full bg-gold px-6 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
          {busy ? "Creating…" : "Create Salon"}
        </button>
      </div>
    </form>
  );
}
