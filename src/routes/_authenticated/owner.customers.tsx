import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { MoreHorizontal, Eye, Ban, CheckCircle2, Loader2 } from "lucide-react";
import {
  listOwnerCustomers, getOwnerCustomer, upsertOwnerCustomerFlag,
} from "@/lib/owner-salon.functions";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/owner/customers")({
  component: OwnerCustomersPage,
});

const STATUS_OPTIONS = ["all", "active", "blocked"] as const;

function OwnerCustomersPage() {
  const { t, i18n } = useTranslation();
  const list = useServerFn(listOwnerCustomers);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [viewId, setViewId] = useState<string | null>(null);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["owner-customers", search, status],
    queryFn: () => list({ data: { search, status: status as any } }),
  });
  const rows = data?.rows ?? [];
  const dateFmt = new Intl.DateTimeFormat(i18n.language);
  const setFlag = useServerFn(upsertOwnerCustomerFlag);

  async function toggleBlock(row: any) {
    try {
      await setFlag({ data: { customer_id: row.id, blocked: !row.blocked_at } });
      toast.success(t("admin.common.success"));
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl">{t("owner.nav.customers")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("owner.customers.subtitle", "Customers who have booked at your salon.")}
        </p>
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
            <option key={s} value={s}>{t(`owner.customers.filter.${s}`, { defaultValue: s })}</option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-hairline bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-background/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-start">{t("admin.common.name")}</th>
              <th className="px-4 py-3 text-start">{t("admin.common.phone")}</th>
              <th className="px-4 py-3 text-start">{t("owner.customers.visits", "Visits")}</th>
              <th className="px-4 py-3 text-start">{t("owner.customers.spent", "Spent")}</th>
              <th className="px-4 py-3 text-start">{t("owner.customers.lastVisit", "Last visit")}</th>
              <th className="px-4 py-3 text-start">{t("admin.common.status")}</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">{t("admin.common.loading")}</td></tr>}
            {rows.map((c: any) => (
              <tr key={c.id} className="border-t border-hairline/40">
                <td className="px-4 py-3">
                  <button className="hover:underline" onClick={() => setViewId(c.id)}>
                    {c.full_name || c.email || "—"}
                  </button>
                  {c.email && <div className="text-xs text-muted-foreground">{c.email}</div>}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{c.phone ?? "—"}</td>
                <td className="px-4 py-3">{c.visits} <span className="text-xs text-muted-foreground">({c.completed})</span></td>
                <td className="px-4 py-3">{c.spent.toFixed(0)} SAR</td>
                <td className="px-4 py-3 text-muted-foreground">{c.last_visit ? dateFmt.format(new Date(c.last_visit)) : "—"}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${c.blocked_at ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"}`}>
                    {c.blocked_at ? t("owner.customers.blocked", "Blocked") : t("admin.status.active", { defaultValue: "active" })}
                  </span>
                </td>
                <td className="px-4 py-3 text-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="rounded-lg border border-hairline p-1.5 text-muted-foreground hover:text-foreground">
                        <MoreHorizontal className="size-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuItem onSelect={() => setViewId(c.id)}>
                        <Eye className="me-2 size-4" /> {t("admin.actions.viewProfile")}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {c.blocked_at ? (
                        <DropdownMenuItem onSelect={() => toggleBlock(c)}>
                          <CheckCircle2 className="me-2 size-4" /> {t("owner.customers.restore", "Restore")}
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onSelect={() => toggleBlock(c)}>
                          <Ban className="me-2 size-4" /> {t("owner.customers.block", "Disable")}
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                {t("owner.customers.empty", "No customers have booked at your salon yet.")}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {viewId && <CustomerDetailDialog id={viewId} onClose={() => setViewId(null)} onChange={refetch} />}
    </div>
  );
}

function CustomerDetailDialog({ id, onClose, onChange }: { id: string; onClose: () => void; onChange: () => void }) {
  const { t, i18n } = useTranslation();
  const fn = useServerFn(getOwnerCustomer);
  const setFlag = useServerFn(upsertOwnerCustomerFlag);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["owner-customer", id],
    queryFn: () => fn({ data: { id } }),
  });
  const [notes, setNotes] = useState<string>("");
  const [savingNotes, setSavingNotes] = useState(false);

  const p: any = data?.profile;
  const flag: any = data?.flag ?? {};
  const bookings = data?.bookings ?? [];
  const reviews = data?.reviews ?? [];
  const dateFmt = new Intl.DateTimeFormat(i18n.language);

  // sync notes when data loads
  const initial = flag?.notes ?? "";
  if (data && notes === "" && initial) setNotes(initial);

  async function saveNotes() {
    setSavingNotes(true);
    try {
      await setFlag({ data: { customer_id: id, notes } });
      toast.success(t("admin.common.success"));
      onChange();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setSavingNotes(false);
    }
  }

  async function toggleBlock() {
    try {
      await setFlag({ data: { customer_id: id, blocked: !flag.blocked_at } });
      toast.success(t("admin.common.success"));
      await refetch();
      onChange();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{p?.full_name || p?.email || t("admin.common.loading")}</DialogTitle>
        </DialogHeader>
        {isLoading || !p ? (
          <div className="grid place-items-center py-10 text-muted-foreground"><Loader2 className="size-5 animate-spin" /></div>
        ) : (
          <div className="space-y-5 text-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              <div><span className="text-xs uppercase text-muted-foreground">{t("admin.common.email")}</span><div>{p.email ?? "—"}</div></div>
              <div><span className="text-xs uppercase text-muted-foreground">{t("admin.common.phone")}</span><div>{p.phone ?? "—"}</div></div>
              <div><span className="text-xs uppercase text-muted-foreground">{t("owner.customers.visits", "Visits")}</span><div>{bookings.length}</div></div>
              <div><span className="text-xs uppercase text-muted-foreground">{t("owner.customers.spent", "Spent")}</span><div>{bookings.filter((b: any) => b.status === "completed").reduce((s: number, b: any) => s + Number(b.price_sar ?? 0), 0).toFixed(0)} SAR</div></div>
            </div>

            <div>
              <label className="text-xs uppercase text-muted-foreground">{t("owner.customers.notes", "Private notes")}</label>
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("owner.customers.notesHint", "Only visible to your salon.")} />
              <div className="mt-2 flex justify-end">
                <Button size="sm" onClick={saveNotes} disabled={savingNotes}>
                  {savingNotes && <Loader2 className="me-2 size-4 animate-spin" />}
                  {t("admin.common.save")}
                </Button>
              </div>
            </div>

            <section>
              <h3 className="mb-2 font-display">{t("owner.customers.bookingHistory", "Booking history")}</h3>
              <div className="space-y-2">
                {bookings.map((b: any) => (
                  <div key={b.id} className="flex items-center justify-between rounded-xl border border-hairline p-3">
                    <div>
                      <div className="font-mono text-xs text-muted-foreground">{b.booking_ref}</div>
                      <div>{dateFmt.format(new Date(b.starts_at))}</div>
                    </div>
                    <div className="text-end">
                      <div className="text-xs uppercase text-muted-foreground">{b.status}</div>
                      <div>{Number(b.price_sar ?? 0).toFixed(0)} SAR</div>
                    </div>
                  </div>
                ))}
                {bookings.length === 0 && <p className="text-muted-foreground">{t("owner.customers.noBookings", "No bookings.")}</p>}
              </div>
            </section>

            {reviews.length > 0 && (
              <section>
                <h3 className="mb-2 font-display">{t("owner.nav.reviews")}</h3>
                {reviews.map((r: any) => (
                  <div key={r.id} className="border-b border-hairline/40 py-2 last:border-0">
                    <div className="text-gold">{"★".repeat(Math.round(Number(r.rating)))}</div>
                    {r.comment && <p className="text-sm">{r.comment}</p>}
                  </div>
                ))}
              </section>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("admin.common.close")}</Button>
          {p && (
            <Button variant={flag?.blocked_at ? "default" : "destructive"} onClick={toggleBlock}>
              {flag?.blocked_at ? t("owner.customers.restore", "Restore") : t("owner.customers.block", "Disable")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
