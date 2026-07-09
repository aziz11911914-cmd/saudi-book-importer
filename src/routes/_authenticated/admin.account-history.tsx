import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, RotateCcw, CheckCircle2, Trash2 } from "lucide-react";
import {
  listAccountHistory,
  setProfileStatus,
  hardDeleteProfile,
} from "@/lib/admin.functions";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StatusPill } from "@/components/admin/user-actions-menu";

export const Route = createFileRoute("/_authenticated/admin/account-history")({
  component: AccountHistoryPage,
});

const STATUS_OPTIONS = ["all", "disabled", "deleted"] as const;

function AccountHistoryPage() {
  const { t, i18n } = useTranslation();
  const list = useServerFn(listAccountHistory);
  const setStatus = useServerFn(setProfileStatus);
  const hardDelete = useServerFn(hardDeleteProfile);
  const [status, setStatus2] = useState<string>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null);
  const dateFmt = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-account-history", status],
    queryFn: () => list({ data: { status: status as any } }),
    refetchOnWindowFocus: true,
  });
  const rows = (data as any[]) ?? [];

  const run = async (fn: () => Promise<any>, id: string, msg: string) => {
    setBusyId(id);
    try { await fn(); toast.success(msg); refetch(); }
    catch (e: any) { toast.error(`${t("admin.common.errorPrefix")}: ${e?.message ?? e}`); }
    finally { setBusyId(null); }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl">{t("admin.pages.accountHistory.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("admin.pages.accountHistory.subtitle")}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={status}
          onChange={(e) => setStatus2(e.target.value)}
          className="rounded-full border border-hairline bg-surface px-4 py-2 text-sm"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? t("admin.common.all") : t(`admin.status.${s}`, s)}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-hairline bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-background/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-start">{t("admin.common.name")}</th>
              <th className="px-4 py-3 text-start">{t("admin.history.role")}</th>
              <th className="px-4 py-3 text-start">{t("admin.common.salon")}</th>
              <th className="px-4 py-3 text-start">{t("admin.common.status")}</th>
              <th className="px-4 py-3 text-start">{t("admin.history.date")}</th>
              <th className="px-4 py-3 text-start">{t("admin.history.actor")}</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">{t("admin.common.loading")}</td></tr>}
            {!isLoading && rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">{t("admin.pages.accountHistory.empty")}</td></tr>}
            {rows.map((r: any) => {
              const salonName = r.salon?.name_en || r.salon?.name_ar || "—";
              const roleLabel = r.role !== "—" ? t(`admin.filters.${r.role}s`, r.role) : "—";
              const when = r.action_at ? dateFmt.format(new Date(r.action_at)) : "—";
              return (
                <tr key={r.id} className="border-t border-hairline/40">
                  <td className="px-4 py-3">
                    <div className="truncate">{r.full_name || `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || r.email}</div>
                    <div className="truncate text-xs text-muted-foreground">{r.email}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{String(roleLabel)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{salonName}</td>
                  <td className="px-4 py-3"><StatusPill status={r.status} /></td>
                  <td className="px-4 py-3 text-muted-foreground">{when}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.actor_email ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      {r.status === "deleted" && (
                        <button
                          disabled={busyId === r.id}
                          onClick={() => run(() => setStatus({ data: { id: r.id, status: "disabled" } }), r.id, t("admin.common.success"))}
                          className="inline-flex items-center gap-1 rounded-lg border border-hairline px-3 py-1 text-xs hover:bg-background"
                        >
                          {busyId === r.id ? <Loader2 className="size-3 animate-spin" /> : <RotateCcw className="size-3" />}
                          {t("admin.actions.restore")}
                        </button>
                      )}
                      <button
                        disabled={busyId === r.id}
                        onClick={() => run(() => setStatus({ data: { id: r.id, status: "active" } }), r.id, t("admin.common.success"))}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 px-3 py-1 text-xs text-emerald-400 hover:bg-emerald-500/10"
                      >
                        <CheckCircle2 className="size-3" /> {t("admin.actions.activate")}
                      </button>
                      <button
                        disabled={busyId === r.id}
                        onClick={() => setConfirmDelId(r.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 px-3 py-1 text-xs text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="size-3" /> {t("admin.actions.permanentDelete")}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <AlertDialog open={!!confirmDelId} onOpenChange={(v) => !v && setConfirmDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-400">{t("admin.history.confirmPermanentTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("admin.history.confirmPermanentBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 text-white hover:bg-red-600"
              onClick={(e) => {
                e.preventDefault();
                const id = confirmDelId!;
                run(() => hardDelete({ data: { id } }), id, t("admin.common.success"))
                  .then(() => setConfirmDelId(null));
              }}
            >
              {t("admin.actions.permanentDelete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
