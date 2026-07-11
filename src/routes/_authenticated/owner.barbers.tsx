import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  MoreHorizontal, Eye, Ban, CheckCircle2, Trash2, Pencil, Loader2,
  Copy, Printer, Share2, X, Plus,
} from "lucide-react";
import {
  listOwnerBarbers, setOwnerBarberStatus, deleteOwnerBarber, upsertOwnerBarber,
  createOwnerBarberCode, listOwnerBarberCodes, revokeOwnerBarberCode,
} from "@/lib/owner-salon.functions";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/locale-provider";
import { useStorageUrl } from "@/lib/storage-url";

export const Route = createFileRoute("/_authenticated/owner/barbers")({
  component: OwnerBarbersPage,
});

const STATUS_OPTIONS = ["all", "active", "inactive", "pending"] as const;

function OwnerBarbersPage() {
  const { t } = useTranslation();
  const list = useServerFn(listOwnerBarbers);
  const listCodes = useServerFn(listOwnerBarberCodes);
  const revoke = useServerFn(revokeOwnerBarberCode);
  const create = useServerFn(createOwnerBarberCode);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [openCode, setOpenCode] = useState<any>(null);
  const [creating, setCreating] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["owner-barbers", search, status],
    queryFn: () => list({ data: { search, status: status as any } }),
  });
  const { data: codes, refetch: refetchCodes } = useQuery({
    queryKey: ["owner-barber-codes"],
    queryFn: () => listCodes(),
  });
  const rows = data?.rows ?? [];

  async function createCode() {
    setCreating(true);
    try {
      const row = await create();
      setOpenCode(row);
      refetchCodes();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">{t("owner.nav.barbers")}</h1>
          <p className="text-sm text-muted-foreground">{t("owner.barbers.subtitle", "Manage the barbers who work at your salon.")}</p>
        </div>
        <button
          onClick={createCode}
          disabled={creating}
          className="inline-flex items-center gap-2 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          {t("owner.barbers.createCode", "Create Barber")}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("admin.common.search")}
          className="w-full max-w-md rounded-full border border-hairline bg-surface px-4 py-2 text-sm outline-none focus:border-gold/60"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-full border border-hairline bg-surface px-4 py-2 text-sm"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? t("admin.filters.allUsers") : t(`admin.status.${s}`, { defaultValue: s })}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {isLoading && <div className="text-muted-foreground">{t("admin.common.loading")}</div>}
        {rows.map((b: any) => <BarberCard key={b.id} barber={b} onChange={refetch} />)}
        {!isLoading && rows.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-hairline p-10 text-center text-sm text-muted-foreground">
            {t("owner.barbers.empty", "No barbers yet. Click Create Barber to generate an invitation code.")}
          </div>
        )}
      </div>

      {(codes ?? []).length > 0 && (
        <section className="rounded-2xl border border-hairline bg-surface p-4">
          <h2 className="mb-3 font-display text-lg">{t("owner.barbers.codesTitle", "Invitation codes")}</h2>
          <ul className="space-y-2 text-sm">
            {(codes ?? []).map((c: any) => (
              <li key={c.id} className="flex items-center justify-between border-b border-hairline/40 pb-2 last:border-0">
                <div>
                  <div className="font-mono text-gold">{c.code}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.status} · {t("admin.common.expires", { defaultValue: "expires" })} {new Date(c.expires_at).toLocaleDateString()}
                  </div>
                </div>
                {c.status === "pending" && (
                  <button
                    onClick={async () => { await revoke({ data: { id: c.id } }); refetchCodes(); }}
                    className="rounded-full border border-hairline px-3 py-1 text-xs"
                  >
                    {t("admin.actions.revoke", { defaultValue: "Revoke" })}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {openCode && <CodeResultDialog row={openCode} onClose={() => setOpenCode(null)} />}
    </div>
  );
}

function BarberCard({ barber, onChange }: { barber: any; onChange: () => void }) {
  const { t } = useTranslation();
  const { tt } = useLocale();
  const setStatus = useServerFn(setOwnerBarberStatus);
  const del = useServerFn(deleteOwnerBarber);
  const upsert = useServerFn(upsertOwnerBarber);
  const [openDel, setOpenDel] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const photo = useStorageUrl(barber.photo_url);
  const cls =
    barber.status === "active"
      ? "bg-emerald-500/10 text-emerald-400"
      : barber.status === "pending"
        ? "bg-amber-500/10 text-amber-400"
        : "bg-red-500/10 text-red-400";

  async function run(fn: () => Promise<any>, msg: string) {
    setBusy(true);
    try { await fn(); toast.success(msg); onChange(); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="rounded-2xl border border-hairline bg-surface p-4 transition hover:border-gold/40">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {photo ? (
            <img src={photo} alt="" className="size-12 rounded-full object-cover" />
          ) : (
            <div className="size-12 rounded-full bg-background" />
          )}
          <div className="min-w-0">
            <div className="truncate font-medium">{tt(barber.display_name_en, barber.display_name_ar)}</div>
            <div className="truncate text-xs text-muted-foreground">
              {tt(barber.title_en ?? "", barber.title_ar ?? "") || t("owner.barbers.roleFallback", "Barber")}
            </div>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded-lg border border-hairline p-1.5 text-muted-foreground hover:text-foreground">
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={() => setOpenEdit(true)}>
              <Pencil className="me-2 size-4" /> {t("admin.actions.edit")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {barber.status === "active" ? (
              <DropdownMenuItem onSelect={() => run(() => setStatus({ data: { id: barber.id, status: "inactive" } }), t("admin.common.success"))}>
                <Ban className="me-2 size-4" /> {t("admin.actions.disable")}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => run(() => setStatus({ data: { id: barber.id, status: "active" } }), t("admin.common.success"))}>
                <CheckCircle2 className="me-2 size-4" /> {t("admin.actions.activate")}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-400 focus:text-red-400" onSelect={() => setOpenDel(true)}>
              <Trash2 className="me-2 size-4" /> {t("admin.actions.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>★ {barber.rating_avg ? Number(barber.rating_avg).toFixed(1) : "—"} ({barber.rating_count ?? 0})</span>
        <span className={`rounded-full px-2 py-0.5 ${cls}`}>{String(t(`admin.status.${barber.status}`, { defaultValue: barber.status }))}</span>
      </div>

      <AlertDialog open={openDel} onOpenChange={setOpenDel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-400">{t("admin.delete.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("admin.delete.body")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              className="bg-red-500 text-white hover:bg-red-600"
              onClick={(e) => { e.preventDefault(); run(() => del({ data: { id: barber.id } }), t("admin.common.success")).then(() => setOpenDel(false)); }}
            >
              {busy && <Loader2 className="me-2 size-4 animate-spin" />}
              {t("admin.delete.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BarberEditDialog
        open={openEdit}
        onClose={() => setOpenEdit(false)}
        barber={barber}
        onSave={async (patch) => {
          await run(() => upsert({ data: { id: barber.id, ...patch } as any }), t("admin.common.success"));
          setOpenEdit(false);
        }}
      />
    </div>
  );
}

function BarberEditDialog({ open, onClose, barber, onSave }: any) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    display_name_en: barber.display_name_en ?? "",
    display_name_ar: barber.display_name_ar ?? "",
    title_en: barber.title_en ?? "",
    title_ar: barber.title_ar ?? "",
  });
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("admin.edit.title")}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Name (EN)</Label><Input value={form.display_name_en} onChange={(e) => setForm({ ...form, display_name_en: e.target.value })} /></div>
          <div><Label>الاسم (AR)</Label><Input value={form.display_name_ar} onChange={(e) => setForm({ ...form, display_name_ar: e.target.value })} /></div>
          <div><Label>Title (EN)</Label><Input value={form.title_en} onChange={(e) => setForm({ ...form, title_en: e.target.value })} /></div>
          <div><Label>المسمى (AR)</Label><Input value={form.title_ar} onChange={(e) => setForm({ ...form, title_ar: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("admin.common.cancel")}</Button>
          <Button onClick={() => onSave(form)}>{t("admin.common.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CodeResultDialog({ row, onClose }: { row: any; onClose: () => void }) {
  const { t } = useTranslation();
  async function copy() { try { await navigator.clipboard.writeText(row.code); toast.success(t("admin.common.copied", { defaultValue: "Copied" })); } catch {} }
  function print() { const w = window.open("", "_blank"); if (!w) return; w.document.write(`<pre style="font-family:monospace;font-size:48px;padding:60px;text-align:center">${row.code}</pre>`); w.document.close(); w.print(); }
  async function share() {
    const text = `Barber invitation code: ${row.code}\nActivate at: ${window.location.origin}/auth`;
    if ((navigator as any).share) { try { await (navigator as any).share({ text }); return; } catch {} }
    try { await navigator.clipboard.writeText(text); toast.success(t("admin.common.copied", { defaultValue: "Copied" })); } catch {}
  }
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("owner.barbers.codeReady", "Invitation code created")}</DialogTitle>
        </DialogHeader>
        <div className="rounded-2xl border border-gold/30 bg-background/40 p-6 text-center">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">{t("owner.barbers.code", "Code")}</div>
          <div className="mt-2 select-all font-mono text-4xl tracking-widest text-gold">{row.code}</div>
          <div className="mt-3 text-xs text-muted-foreground">
            {t("admin.common.expires", { defaultValue: "expires" })} {new Date(row.expires_at).toLocaleDateString()}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={copy} className="inline-flex items-center gap-2 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-primary-foreground"><Copy className="size-4"/>{t("admin.common.copy", { defaultValue: "Copy" })}</button>
          <button onClick={print} className="inline-flex items-center gap-2 rounded-full border border-hairline px-4 py-2 text-sm"><Printer className="size-4"/>Print</button>
          <button onClick={share} className="inline-flex items-center gap-2 rounded-full border border-hairline px-4 py-2 text-sm"><Share2 className="size-4"/>Share</button>
          <button onClick={onClose} className="inline-flex items-center gap-2 rounded-full border border-hairline px-4 py-2 text-sm ms-auto"><X className="size-4"/>{t("admin.common.close")}</button>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("owner.barbers.codeHelp", "Share this code with your barber. They will enter it on the sign-in page and their account will be linked to your salon automatically.")}
        </p>
        <Link to="/owner/barbers" className="hidden">back</Link>
      </DialogContent>
    </Dialog>
  );
}
