import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { MoreHorizontal, Eye, Pencil, Ban, CheckCircle2, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  setProfileStatus, softDeleteProfile, getUserDependencies, updateProfile,
} from "@/lib/admin.functions";

type Props = {
  user: {
    id: string;
    email?: string | null;
    full_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
    status: string;
  };
  viewHref?: { to: string; params: Record<string, string> };
  onChange?: () => void;
};

export function UserActionsMenu({ user, viewHref, onChange }: Props) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const setStatus = useServerFn(setProfileStatus);
  const softDelete = useServerFn(softDeleteProfile);
  const getDeps = useServerFn(getUserDependencies);
  const update = useServerFn(updateProfile);

  const [busy, setBusy] = useState<null | "activate" | "disable" | "delete" | "save">(null);
  const [openDisable, setOpenDisable] = useState(false);
  const [openActivate, setOpenActivate] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [deps, setDeps] = useState<any>(null);
  const [reason, setReason] = useState("");
  const [form, setForm] = useState({
    full_name: user.full_name ?? "",
    first_name: user.first_name ?? "",
    last_name: user.last_name ?? "",
    phone: user.phone ?? "",
    email: user.email ?? "",
  });

  const call = async (fn: () => Promise<any>, msg: string, key: typeof busy) => {
    setBusy(key);
    try {
      await fn();
      toast.success(msg);
      onChange?.();
    } catch (e: any) {
      toast.error(`${t("admin.common.errorPrefix")}: ${e?.message ?? e}`);
    } finally {
      setBusy(null);
    }
  };

  const openDeleteWithDeps = async () => {
    setDeps(null);
    setOpenDelete(true);
    try { setDeps(await getDeps({ data: { id: user.id } })); } catch {}
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button aria-label={t("admin.common.actions")} className="rounded-lg border border-hairline p-1.5 text-muted-foreground hover:bg-background hover:text-foreground">
            <MoreHorizontal className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {viewHref && (
            <DropdownMenuItem onSelect={() => nav({ to: viewHref.to as any, params: viewHref.params as any })}>
              <Eye className="me-2 size-4" /> {t("admin.actions.viewProfile")}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setOpenEdit(true)}>
            <Pencil className="me-2 size-4" /> {t("admin.actions.edit")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {user.status === "active" ? (
            <DropdownMenuItem onSelect={() => setOpenDisable(true)}>
              <Ban className="me-2 size-4" /> {t("admin.actions.disable")}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => setOpenActivate(true)}>
              <CheckCircle2 className="me-2 size-4" /> {t("admin.actions.activate")}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={openDeleteWithDeps} className="text-red-400 focus:text-red-400">
            <Trash2 className="me-2 size-4" /> {t("admin.actions.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Disable */}
      <AlertDialog open={openDisable} onOpenChange={setOpenDisable}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.disable.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("admin.disable.body")}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label>{t("admin.disable.reasonLabel")}</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy === "disable"}
              onClick={(e) => { e.preventDefault(); call(
                () => setStatus({ data: { id: user.id, status: "disabled", reason } }),
                t("admin.common.success"), "disable"
              ).then(() => setOpenDisable(false)); }}
            >
              {busy === "disable" && <Loader2 className="me-2 size-4 animate-spin" />}
              {t("admin.actions.disable")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Activate */}
      <AlertDialog open={openActivate} onOpenChange={setOpenActivate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.activate.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("admin.activate.body")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy === "activate"}
              onClick={(e) => { e.preventDefault(); call(
                () => setStatus({ data: { id: user.id, status: "active" } }),
                t("admin.common.success"), "activate"
              ).then(() => setOpenActivate(false)); }}
            >
              {busy === "activate" && <Loader2 className="me-2 size-4 animate-spin" />}
              {t("admin.actions.activate")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete */}
      <AlertDialog open={openDelete} onOpenChange={setOpenDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-400">{t("admin.delete.title")}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>{t("admin.delete.body")}</p>
                {deps ? (
                  <ul className="list-disc space-y-1 ps-5 text-xs text-muted-foreground">
                    {deps.bookings > 0 && <li>{t("admin.delete.hasBookings", { count: deps.bookings })}</li>}
                    {deps.activeBookings > 0 && <li className="text-amber-400">{t("admin.delete.hasActive", { count: deps.activeBookings })}</li>}
                    {deps.reviews > 0 && <li>{t("admin.delete.hasReviews", { count: deps.reviews })}</li>}
                    {deps.shops > 0 && <li>{t("admin.delete.hasShops", { count: deps.shops })}</li>}
                    {deps.barbers > 0 && <li>{t("admin.delete.hasBarbers", { count: deps.barbers })}</li>}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">{t("admin.common.loading")}</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy === "delete"}
              className="bg-red-500 text-white hover:bg-red-600"
              onClick={(e) => { e.preventDefault(); call(
                () => softDelete({ data: { id: user.id } }),
                t("admin.common.success"), "delete"
              ).then(() => setOpenDelete(false)); }}
            >
              {busy === "delete" && <Loader2 className="me-2 size-4 animate-spin" />}
              {t("admin.delete.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit */}
      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.edit.title")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div><Label>{t("admin.edit.fullName")}</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>{t("admin.edit.firstName")}</Label><Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
              <div><Label>{t("admin.edit.lastName")}</Label><Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
            </div>
            <div><Label>{t("admin.edit.phone")}</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>{t("admin.edit.email")}</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenEdit(false)}>{t("admin.common.cancel")}</Button>
            <Button
              disabled={busy === "save"}
              onClick={() => call(
                () => update({ data: { id: user.id, patch: {
                  full_name: form.full_name || null,
                  first_name: form.first_name || null,
                  last_name: form.last_name || null,
                  phone: form.phone || null,
                  email: form.email || null,
                } } }),
                t("admin.common.success"), "save"
              ).then(() => setOpenEdit(false))}
            >
              {busy === "save" && <Loader2 className="me-2 size-4 animate-spin" />}
              {t("admin.common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function StatusPill({ status }: { status: string }) {
  const { t } = useTranslation();
  const cls: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-400",
    suspended: "bg-red-500/10 text-red-400",
    disabled: "bg-red-500/10 text-red-400",
    pending: "bg-amber-500/10 text-amber-400",
    deleted: "bg-neutral-500/10 text-neutral-400 line-through",
    inactive: "bg-neutral-500/10 text-neutral-400",
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs ${cls[status] ?? "bg-neutral-500/10 text-neutral-400"}`}>{String(t(`admin.status.${status}`, { defaultValue: status }))}</span>;
}
