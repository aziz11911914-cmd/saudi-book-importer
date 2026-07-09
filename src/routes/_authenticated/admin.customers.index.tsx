import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { listCustomers } from "@/lib/admin.functions";
import { UserActionsMenu, StatusPill } from "@/components/admin/user-actions-menu";

export const Route = createFileRoute("/_authenticated/admin/customers/")({
  component: CustomersPage,
});

const STATUS_OPTIONS = ["all", "active", "disabled", "pending", "deleted", "suspended"] as const;

function CustomersPage() {
  const { t, i18n } = useTranslation();
  const list = useServerFn(listCustomers);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-customers", search, status, page],
    queryFn: () => list({ data: { search, status, page, pageSize } }),
  });
  const rows = (data as any)?.rows ?? [];
  const total = (data as any)?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const dateFmt = new Intl.DateTimeFormat(i18n.language);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl">{t("admin.pages.customers.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("admin.pages.customers.subtitle")}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder={t("admin.common.search")}
          className="w-full max-w-md rounded-full border border-hairline bg-surface px-4 py-2 text-sm outline-none focus:border-gold/60"
        />
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="rounded-full border border-hairline bg-surface px-4 py-2 text-sm"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s === "all" ? t("admin.filters.allUsers") : t(`admin.status.${s}`, s)}</option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-hairline bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-background/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-start">{t("admin.common.name")}</th>
              <th className="px-4 py-3 text-start">{t("admin.common.email")}</th>
              <th className="px-4 py-3 text-start">{t("admin.common.phone")}</th>
              <th className="px-4 py-3 text-start">{t("admin.common.status")}</th>
              <th className="px-4 py-3 text-start">{t("admin.common.joined")}</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">{t("admin.common.loading")}</td></tr>}
            {rows.map((c: any) => (
              <tr key={c.id} className="border-t border-hairline/40">
                <td className="px-4 py-3"><Link to="/admin/customers/$id" params={{ id: c.id }} className="hover:underline">{c.full_name || c.email}</Link></td>
                <td className="px-4 py-3 text-muted-foreground">{c.email}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.phone ?? "—"}</td>
                <td className="px-4 py-3"><StatusPill status={c.status} /></td>
                <td className="px-4 py-3 text-muted-foreground">{dateFmt.format(new Date(c.created_at))}</td>
                <td className="px-4 py-3 text-end">
                  <UserActionsMenu
                    user={c}
                    viewHref={{ to: "/admin/customers/$id", params: { id: c.id } }}
                    onChange={refetch}
                  />
                </td>
              </tr>
            ))}
            {!isLoading && rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">{t("admin.pages.customers.empty")}</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager page={page} totalPages={totalPages} onChange={setPage} />
    </div>
  );
}

function Pager({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  const { t } = useTranslation();
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
      <button disabled={page <= 1} onClick={() => onChange(page - 1)} className="rounded-lg border border-hairline px-3 py-1 disabled:opacity-40">{t("admin.common.previous")}</button>
      <span>{t("admin.common.page")} {page} {t("admin.common.of")} {totalPages}</span>
      <button disabled={page >= totalPages} onClick={() => onChange(page + 1)} className="rounded-lg border border-hairline px-3 py-1 disabled:opacity-40">{t("admin.common.next")}</button>
    </div>
  );
}
