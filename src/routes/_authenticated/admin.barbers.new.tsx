import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { createInvite, listSalons } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/barbers/new")({
  component: NewBarberPage,
});

const input = "w-full rounded-2xl border border-hairline bg-background px-4 py-2.5 text-sm outline-none focus:border-gold/60";

function NewBarberPage() {
  const navigate = useNavigate();
  const invite = useServerFn(createInvite);
  const shopsFn = useServerFn(listSalons);
  const { data: shops } = useQuery({ queryKey: ["admin-salons-min"], queryFn: () => shopsFn({ data: {} }) });
  const [form, setForm] = useState<any>({ email: "", full_name: "", phone: "", nationality: "", language: "ar", shop_id: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!form.shop_id) { setError("Please assign a salon."); return; }
    setSaving(true); setError(null);
    try {
      const row = await invite({ data: {
        email: form.email, role: "barber", shop_id: form.shop_id,
        full_name: form.full_name || undefined, phone: form.phone || undefined,
        nationality: form.nationality || undefined, language: form.language || undefined,
        notes: form.notes || undefined,
      }});
      setCreated(row);
    } catch (e: any) { setError(e?.message ?? "Failed"); }
    finally { setSaving(false); }
  }

  if (created) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/invite/${created.token}`;
    const message = `You're invited to join Qassah as a barber.\n\nOpen this link to accept: ${url}\n\n(Use email: ${created.email})`;
    return (
      <div className="mx-auto max-w-2xl space-y-4 rounded-2xl border border-hairline bg-surface p-6">
        <h1 className="font-display text-2xl">Barber invited ✓</h1>
        <p className="text-sm text-muted-foreground">
          Share this link with <b>{created.email}</b>. When they open it and complete email OTP sign-in, their Barber profile will be created at the assigned salon.
        </p>
        <div className="flex items-center gap-2">
          <input readOnly value={url} className={input} onFocus={(e) => e.currentTarget.select()} />
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => navigator.clipboard.writeText(url)} className="rounded-full bg-gold px-4 py-2 text-sm font-semibold text-primary-foreground">Copy Link</button>
          <button onClick={() => navigator.clipboard.writeText(message)} className="rounded-full border border-hairline px-4 py-2 text-sm">Copy Invitation</button>
          <button disabled title="SMTP delivery — coming soon" className="rounded-full border border-hairline px-4 py-2 text-sm opacity-60 cursor-not-allowed">Send Email (coming soon)</button>
        </div>
        <div className="flex gap-2 pt-2">
          <Link to="/admin/barbers" className="rounded-full border border-hairline px-4 py-2 text-sm">Back</Link>
          <button onClick={() => { setCreated(null); setForm({ email: "", full_name: "", phone: "", nationality: "", language: "ar", shop_id: "", notes: "" }); }} className="rounded-full border border-hairline px-4 py-2 text-sm">Invite another</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div><Link to="/admin/barbers" className="text-xs text-muted-foreground hover:underline">← Barbers</Link><h1 className="font-display text-3xl">Invite Barber</h1></div>
      <div className="space-y-3 rounded-2xl border border-hairline bg-surface p-5">
        <Field label="Email *"><input className={input} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" /></Field>
        <Field label="Assign salon *">
          <select className={input} value={form.shop_id} onChange={(e) => setForm({ ...form, shop_id: e.target.value })}>
            <option value="">— Select —</option>
            {(shops ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.name_en}</option>)}
          </select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Full name"><input className={input} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
          <Field label="Phone"><input className={input} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Nationality"><input className={input} value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} /></Field>
          <Field label="Language"><select className={input} value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}><option value="ar">Arabic</option><option value="en">English</option></select></Field>
        </div>
        <Field label="Notes"><textarea className={input} rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={() => navigate({ to: "/admin/barbers" })} className="rounded-full border border-hairline px-5 py-2 text-sm">Cancel</button>
          <button onClick={submit} disabled={!form.email || saving} className="rounded-full bg-gold px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">{saving ? "Inviting…" : "Send invitation"}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs font-medium text-muted-foreground">{label}</span><div className="mt-1.5">{children}</div></label>;
}
