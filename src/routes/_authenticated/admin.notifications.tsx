import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { broadcastNotification } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/notifications")({
  component: NotificationsPage,
});

function NotificationsPage() {
  const fn = useServerFn(broadcastNotification);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<"all" | "owners" | "barbers" | "customers">("all");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const r = await fn({ data: { title, body: body || undefined, audience } });
      setMsg(`Sent to ${r.sent} users.`);
      setTitle(""); setBody("");
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div><h1 className="font-display text-3xl">Notifications</h1><p className="text-sm text-muted-foreground">Send an in-app announcement.</p></div>
      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-hairline bg-surface p-5">
        <label className="block"><span className="text-xs text-muted-foreground">Audience</span>
          <select value={audience} onChange={(e) => setAudience(e.target.value as any)} className="mt-1.5 w-full rounded-2xl border border-hairline bg-background px-4 py-2.5 text-sm">
            <option value="all">All users</option><option value="owners">Owners</option><option value="barbers">Barbers</option><option value="customers">Customers</option>
          </select>
        </label>
        <label className="block"><span className="text-xs text-muted-foreground">Title</span>
          <input required value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1.5 w-full rounded-2xl border border-hairline bg-background px-4 py-2.5 text-sm" />
        </label>
        <label className="block"><span className="text-xs text-muted-foreground">Body (optional)</span>
          <textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} className="mt-1.5 w-full rounded-2xl border border-hairline bg-background px-4 py-2.5 text-sm" />
        </label>
        <button disabled={busy} className="rounded-full bg-gold px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">{busy ? "Sending…" : "Send Announcement"}</button>
        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
      </form>
    </div>
  );
}
