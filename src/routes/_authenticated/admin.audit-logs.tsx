import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listAuditLogs } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/audit-logs")({
  component: AuditPage,
});

function AuditPage() {
  const fn = useServerFn(listAuditLogs);
  const { data, isLoading } = useQuery({ queryKey: ["admin-audit"], queryFn: () => fn() });
  return (
    <div className="space-y-4">
      <div><h1 className="font-display text-3xl">Audit Logs</h1><p className="text-sm text-muted-foreground">Every important action recorded.</p></div>
      <div className="overflow-x-auto rounded-2xl border border-hairline bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-background/40 text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-3 text-start">When</th><th className="px-4 py-3 text-start">Action</th><th className="px-4 py-3 text-start">Actor</th><th className="px-4 py-3 text-start">Target</th><th className="px-4 py-3 text-start">Details</th></tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>}
            {(data ?? []).map((a: any) => (
              <tr key={a.id} className="border-t border-hairline/40">
                <td className="px-4 py-3 text-muted-foreground">{new Date(a.created_at).toLocaleString()}</td>
                <td className="px-4 py-3 font-mono text-xs">{a.action}</td>
                <td className="px-4 py-3 text-muted-foreground">{a.actor_email ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{a.target_type ?? "—"} {a.target_id ? `· ${a.target_id.slice(0,8)}` : ""}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground"><code>{JSON.stringify(a.details)}</code></td>
              </tr>
            ))}
            {!isLoading && (data?.length ?? 0) === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No audit entries yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
