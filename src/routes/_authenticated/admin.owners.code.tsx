import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Copy, Printer, Share2, RefreshCw } from "lucide-react";
import { listSalons } from "@/lib/admin.functions";
import { createInvitationCode } from "@/lib/invitation-codes.functions";

export const Route = createFileRoute("/_authenticated/admin/owners/code")({
  component: NewOwnerCodePage,
});

const input =
  "w-full rounded-2xl border border-hairline bg-background px-4 py-2.5 text-sm outline-none focus:border-gold/60";

function NewOwnerCodePage() {
  const navigate = useNavigate();
  const create = useServerFn(createInvitationCode);
  const shopsFn = useServerFn(listSalons);
  const { data: shops } = useQuery({ queryKey: ["admin-salons-min"], queryFn: () => shopsFn({ data: {} }) });
  const [shopId, setShopId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const row = await create({ data: { role: "owner", shop_id: shopId || null } });
      setCreated(row);
    } catch (e: any) {
      setError(e?.message ?? "Failed to generate code");
    } finally {
      setSaving(false);
    }
  }

  if (created) return <CodeResult row={created} onNew={() => setCreated(null)} backTo="/admin/owners" />;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link to="/admin/owners" className="text-xs text-muted-foreground hover:underline">← Owners</Link>
        <h1 className="font-display text-3xl">Create Owner with Invitation Code</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Only pick a salon. A unique one-time code will be generated. Share it with the future owner — they'll enter it on the sign-in page to activate their account.
        </p>
      </div>
      <div className="space-y-3 rounded-2xl border border-hairline bg-surface p-5">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Assign salon</span>
          <select className={`${input} mt-1.5`} value={shopId} onChange={(e) => setShopId(e.target.value)}>
            <option value="">— None —</option>
            {(shops ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.name_en}</option>)}
          </select>
        </label>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={() => navigate({ to: "/admin/owners" })} className="rounded-full border border-hairline px-5 py-2 text-sm">Cancel</button>
          <button onClick={submit} disabled={saving} className="rounded-full bg-gold px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {saving ? "Generating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CodeResult({ row, onNew, backTo }: { row: any; onNew: () => void; backTo: "/admin/owners" | "/admin/barbers" }) {
  async function copy() { try { await navigator.clipboard.writeText(row.code); } catch {} }
  function print() { const w = window.open("", "_blank"); if (!w) return; w.document.write(`<pre style="font-family:monospace;font-size:48px;padding:60px;text-align:center">${row.code}</pre>`); w.document.close(); w.print(); }
  async function share() {
    const text = `Your Qassah invitation code: ${row.code}\nActivate at: ${window.location.origin}/auth`;
    if ((navigator as any).share) { try { await (navigator as any).share({ text }); return; } catch {} }
    try { await navigator.clipboard.writeText(text); } catch {}
  }
  return (
    <div className="mx-auto max-w-2xl space-y-4 rounded-2xl border border-hairline bg-surface p-6">
      <h1 className="font-display text-2xl">Invitation code created ✓</h1>
      <div className="rounded-2xl border border-gold/30 bg-background/40 p-6 text-center">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Code</div>
        <div className="mt-2 select-all font-mono text-4xl tracking-widest text-gold">{row.code}</div>
        <div className="mt-3 text-xs text-muted-foreground">
          Expires {new Date(row.expires_at).toLocaleDateString()} · One-time use
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={copy} className="inline-flex items-center gap-2 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-primary-foreground"><Copy className="size-4"/>Copy</button>
        <button onClick={print} className="inline-flex items-center gap-2 rounded-full border border-hairline px-4 py-2 text-sm"><Printer className="size-4"/>Print</button>
        <button onClick={share} className="inline-flex items-center gap-2 rounded-full border border-hairline px-4 py-2 text-sm"><Share2 className="size-4"/>Share</button>
        <button onClick={onNew} className="inline-flex items-center gap-2 rounded-full border border-hairline px-4 py-2 text-sm"><RefreshCw className="size-4"/>Generate another</button>
      </div>
      <div className="pt-2">
        <Link to={backTo} className="rounded-full border border-hairline px-4 py-2 text-sm">Back</Link>
      </div>
    </div>
  );
}
