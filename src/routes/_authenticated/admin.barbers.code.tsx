import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listSalons } from "@/lib/admin.functions";
import { createInvitationCode } from "@/lib/invitation-codes.functions";
import { CodeResult } from "./admin.owners.code";

export const Route = createFileRoute("/_authenticated/admin/barbers/code")({
  component: NewBarberCodePage,
});

const input =
  "w-full rounded-2xl border border-hairline bg-background px-4 py-2.5 text-sm outline-none focus:border-gold/60";

function NewBarberCodePage() {
  const navigate = useNavigate();
  const create = useServerFn(createInvitationCode);
  const shopsFn = useServerFn(listSalons);
  const { data: shops } = useQuery({ queryKey: ["admin-salons-min"], queryFn: () => shopsFn({ data: {} }) });
  const [shopId, setShopId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!shopId) { setError("Please select a salon."); return; }
    setSaving(true);
    setError(null);
    try {
      const row = await create({ data: { role: "barber", shop_id: shopId } });
      setCreated(row);
    } catch (e: any) {
      setError(e?.message ?? "Failed to generate code");
    } finally {
      setSaving(false);
    }
  }

  if (created) return <CodeResult row={created} onNew={() => setCreated(null)} backTo="/admin/barbers" />;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link to="/admin/barbers" className="text-xs text-muted-foreground hover:underline">← Barbers</Link>
        <h1 className="font-display text-3xl">Create Barber with Invitation Code</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a salon. A unique one-time code will be generated for the new barber.
        </p>
      </div>
      <div className="space-y-3 rounded-2xl border border-hairline bg-surface p-5">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Assign salon *</span>
          <select className={`${input} mt-1.5`} value={shopId} onChange={(e) => setShopId(e.target.value)}>
            <option value="">— Select —</option>
            {(shops ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.name_en}</option>)}
          </select>
        </label>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={() => navigate({ to: "/admin/barbers" })} className="rounded-full border border-hairline px-5 py-2 text-sm">Cancel</button>
          <button onClick={submit} disabled={saving || !shopId} className="rounded-full bg-gold px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {saving ? "Generating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
