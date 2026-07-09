import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { listOwners } from "@/lib/admin.functions";
import { listInvitationCodes, revokeInvitationCode } from "@/lib/invitation-codes.functions";
import { UserActionsMenu, StatusPill } from "@/components/admin/user-actions-menu";

export const Route = createFileRoute("/_authenticated/admin/owners/")({
  component: OwnersPage,
});

const STATUS_OPTIONS = ["all", "active", "disabled", "pending", "deleted", "suspended"] as const;

function OwnersPage() {
  const { t, i18n } = useTranslation();
  const list = useServerFn(listOwners);
  const listCodes = useServerFn(listInvitationCodes);
  const revoke = useServerFn(revokeInvitationCode);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-owners", search, status, page],
    queryFn: () => list({ data: { search, status, page, pageSize } }),
  });
  const { data: codes, refetch: refetchCodes } = useQuery({
    queryKey: ["owner-codes"],
    queryFn: () => listCodes({ data: { role: "owner" } }),
  });
  const rows = (data as any)?.rows ?? [];
  const total = (data as any)?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const dateFmt = new Intl.DateTimeFormat(i18n.language);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">{t("admin.pages.owners.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("admin.pages.owners.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/owners/new" className="rounded-full bg-gold px-4 py-2 text-sm font-semibold text-primary-foreground">+ {t("admin.pages.owners.invite")}</Link>
          <Link to="/admin/owners/code" className="rounded-full border border-gold/60 px-4 py-2 text-sm font-semibold text-gold">{t("admin.pages.owners.createWithCode")}</Link>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder={t("admin.common.search")}
          className="w-full max-w-md rounded-full border border-hairline bg-surface px-4 py-2 text-sm outline-none focus:border-gold/60"
        />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="rounded-full border border-hairline bg-surface px-4 py-2 text-sm">
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
              <th className="px-4 py-3 text-start">{t("admin.common.salon")}</th>
              <th className="px-4 py-3 text-start">{t("admin.common.phone")}</th>
              <th className="px-4 py-3 text-start">{t("admin.common.email")}</th>
              <th className="px-4 py-3 text-start">{t("admin.common.status")}</th>
              <th className="px-4 py-3 text-start">{t("admin.common.lastLogin")}</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">{t("admin.common.loading")}</td></tr>}
            {!isLoading && rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">{t("admin.pages.owners.empty")}</td></tr>}
            {rows.map((o: any) => (
              <tr key={o.id} className="border-t border-hairline/40">
                <td className="px-4 py-3"><Link to="/admin/owners/$id" params={{ id: o.id }} className="hover:underline">{o.full_name || `${o.first_name ?? ""} ${o.last_name ?? ""}`.trim() || o.email}</Link></td>
                <td className="px-4 py-3 text-muted-foreground">{o.shop?.name_en ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{o.phone ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{o.email}</td>
                <td className="px-4 py-3"><StatusPill status={o.status} /></td>
                <td className="px-4 py-3 text-muted-foreground">{o.last_login_at ? dateFmt.format(new Date(o.last_login_at)) : "—"}</td>
                <td className="px-4 py-3 text-end">
                  <UserActionsMenu user={o} viewHref={{ to: "/admin/owners/$id", params: { id: o.id } }} onChange={refetch} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-hairline px-3 py-1 disabled:opacity-40">{t("admin.common.previous")}</button>
          <span>{t("admin.common.page")} {page} {t("admin.common.of")} {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="rounded-lg border border-hairline px-3 py-1 disabled:opacity-40">{t("admin.common.next")}</button>
        </div>
      )}
      <CodesSection title={t("admin.pages.owners.title") + " – Codes"} codes={codes ?? []} onRevoke={async (id) => { await revoke({ data: { id } }); refetchCodes(); }} />
    </div>
  );
}

export function CodesSection({ title, codes, onRevoke }: { title: string; codes: any[]; onRevoke: (id: string) => void }) {
  const { t, i18n } = useTranslation();
  const dateFmt = new Intl.DateTimeFormat(i18n.language);
  if (!codes.length) return null;
  return (
    <div className="space-y-2">
      <h2 className="font-display text-xl">{title}</h2>
      <div className="overflow-x-auto rounded-2xl border border-hairline bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-background/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-start">Code</th>
              <th className="px-4 py-3 text-start">{t("admin.common.salon")}</th>
              <th className="px-4 py-3 text-start">{t("admin.common.status")}</th>
              <th className="px-4 py-3 text-start">{t("admin.common.joined")}</th>
              <th className="px-4 py-3 text-start">Expires</th>
              <th className="px-4 py-3 text-start">Used</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {codes.map((c: any) => {
              const expired = c.status === "pending" && new Date(c.expires_at).getTime() < Date.now();
              const label = c.status === "activated" ? t("admin.status.active") : c.status === "revoked" ? t("admin.common.revoke") : expired ? "Expired" : t("admin.status.pending");
              const cls = c.status === "activated" ? "bg-emerald-500/10 text-emerald-400" : c.status === "revoked" ? "bg-red-500/10 text-red-400" : expired ? "bg-amber-500/10 text-amber-400" : "bg-gold/10 text-gold";
              return (
                <tr key={c.id} className="border-t border-hairline/40">
                  <td className="px-4 py-3 font-mono">{c.code}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.shop?.name_en ?? "—"}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs ${cls}`}>{label}</span></td>
                  <td className="px-4 py-3 text-muted-foreground">{dateFmt.format(new Date(c.created_at))}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.status === "activated" ? "—" : dateFmt.format(new Date(c.expires_at))}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.used_at ? t("admin.common.yes") : t("admin.common.no")}</td>
                  <td className="px-4 py-3 text-end">
                    {c.status === "pending" && !expired && (
                      <button onClick={() => onRevoke(c.id)} className="rounded-lg border border-hairline px-3 py-1 text-xs">{t("admin.common.revoke")}</button>
                    )}
                    <button onClick={() => { navigator.clipboard.writeText(c.code).catch(() => {}); }} className="ms-2 rounded-lg border border-hairline px-3 py-1 text-xs">{t("admin.common.copy")}</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
