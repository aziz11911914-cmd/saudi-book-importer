import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  MoreHorizontal, Eye, Ban, CheckCircle2, Trash2, Loader2,
} from "lucide-react";
import { listBarbers, setBarberStatus, softDeleteBarber } from "@/lib/admin.functions";
import { listInvitationCodes, revokeInvitationCode } from "@/lib/invitation-codes.functions";
import { CodesSection } from "./admin.owners.index";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/admin/barbers/")({
  component: BarbersPage,
});

const STATUS_OPTIONS = ["all", "active", "inactive", "pending"] as const;

function BarbersPage() {
  const { t } = useTranslation();
  const list = useServerFn(listBarbers);
  const listCodes = useServerFn(listInvitationCodes);
  const revoke = useServerFn(revokeInvitationCode);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 24;
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-barbers", search, status, page],
    queryFn: () => list({ data: { search, status, page, pageSize } }),
  });
  const { data: codes, refetch: refetchCodes } = useQuery({
    queryKey: ["barber-codes"],
    queryFn: () => listCodes({ data: { role: "barber" } }),
  });
  const rows = (data as any)?.rows ?? [];
  const total = (data as any)?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">{t("admin.pages.barbers.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("admin.pages.barbers.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/barbers/new" className="rounded-full bg-gold px-4 py-2 text-sm font-semibold text-primary-foreground">+ {t("admin.pages.barbers.invite")}</Link>
          <Link to="/admin/barbers/code" className="rounded-full border border-gold/60 px-4 py-2 text-sm font-semibold text-gold">{t("admin.pages.barbers.createWithCode")}</Link>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={t("admin.common.search")} className="w-full max-w-md rounded-full border border-hairline bg-surface px-4 py-2 text-sm outline-none focus:border-gold/60" />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="rounded-full border border-hairline bg-surface px-4 py-2 text-sm">
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s === "all" ? t("admin.filters.allUsers") : t(`admin.status.${s}`, s)}</option>
          ))}
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {isLoading && <div className="text-muted-foreground">{t("admin.common.loading")}</div>}
        {rows.map((b: any) => <BarberCard key={b.id} barber={b} onChange={refetch} />)}
        {!isLoading && rows.length === 0 && <div className="text-muted-foreground">{t("admin.pages.barbers.empty")}</div>}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-hairline px-3 py-1 disabled:opacity-40">{t("admin.common.previous")}</button>
          <span>{t("admin.common.page")} {page} {t("admin.common.of")} {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="rounded-lg border border-hairline px-3 py-1 disabled:opacity-40">{t("admin.common.next")}</button>
        </div>
      )}
      <CodesSection title={t("admin.pages.barbers.title") + " – Codes"} codes={codes ?? []} onRevoke={async (id) => { await revoke({ data: { id } }); refetchCodes(); }} />
    </div>
  );
}

function BarberCard({ barber, onChange }: { barber: any; onChange: () => void }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const setStatus = useServerFn(setBarberStatus);
  const softDel = useServerFn(softDeleteBarber);
  const [openDel, setOpenDel] = useState(false);
  const [busy, setBusy] = useState(false);
  const cls = barber.status === "active" ? "bg-emerald-500/10 text-emerald-400" : barber.status === "pending" ? "bg-amber-500/10 text-amber-400" : "bg-red-500/10 text-red-400";
  const runStatus = async (s: "active" | "inactive") => {
    setBusy(true);
    try { await setStatus({ data: { id: barber.id, status: s } }); toast.success(t("admin.common.success")); onChange(); }
    catch (e: any) { toast.error(`${t("admin.common.errorPrefix")}: ${e?.message ?? e}`); }
    finally { setBusy(false); }
  };
  return (
    <div className="rounded-2xl border border-hairline bg-surface p-4 transition hover:border-gold/40">
      <div className="flex items-start justify-between gap-3">
        <Link to="/admin/barbers/$id" params={{ id: barber.id }} className="flex min-w-0 items-center gap-3">
          {barber.photo_url ? <img src={barber.photo_url} alt="" className="size-12 rounded-full object-cover" /> : <div className="size-12 rounded-full bg-background" />}
          <div className="min-w-0">
            <div className="truncate font-medium">{barber.display_name_en}</div>
            <div className="truncate text-xs text-muted-foreground">{barber.shops?.name_en ?? "—"}</div>
          </div>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded-lg border border-hairline p-1.5 text-muted-foreground hover:text-foreground"><MoreHorizontal className="size-4" /></button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onSelect={() => nav({ to: "/admin/barbers/$id", params: { id: barber.id } })}>
              <Eye className="me-2 size-4" /> {t("admin.actions.viewProfile")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {barber.status === "active" ? (
              <DropdownMenuItem onSelect={() => runStatus("inactive")}><Ban className="me-2 size-4" /> {t("admin.actions.disable")}</DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => runStatus("active")}><CheckCircle2 className="me-2 size-4" /> {t("admin.actions.activate")}</DropdownMenuItem>
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
        <span className={`rounded-full px-2 py-0.5 ${cls}`}>{t(`admin.status.${barber.status}`, barber.status)}</span>
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
              onClick={async (e) => {
                e.preventDefault(); setBusy(true);
                try { await softDel({ data: { id: barber.id } }); toast.success(t("admin.common.success")); onChange(); setOpenDel(false); }
                catch (err: any) { toast.error(`${t("admin.common.errorPrefix")}: ${err?.message ?? err}`); }
                finally { setBusy(false); }
              }}
            >
              {busy && <Loader2 className="me-2 size-4 animate-spin" />}
              {t("admin.delete.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
