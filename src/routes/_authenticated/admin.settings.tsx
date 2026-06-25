import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getSettings, updateSettings } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: SettingsPage,
});

const input = "w-full rounded-2xl border border-hairline bg-background px-4 py-2.5 text-sm outline-none focus:border-gold/60";

function SettingsPage() {
  const fn = useServerFn(getSettings);
  const upd = useServerFn(updateSettings);
  const { data, refetch } = useQuery({ queryKey: ["admin-settings"], queryFn: () => fn() });
  const [form, setForm] = useState<any>(null);
  useEffect(() => { if (data) setForm({ ...data }); }, [data]);

  if (!form) return <div className="text-muted-foreground">Loading…</div>;

  async function saveSection(section: "general" | "booking" | "authentication" | "notifications" | "maintenance") {
    await upd({ data: { section, values: form[section] } });
    await refetch();
  }
  const set = (section: string, key: string, value: any) => setForm({ ...form, [section]: { ...form[section], [key]: value } });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div><h1 className="font-display text-3xl">Platform Settings</h1><p className="text-sm text-muted-foreground">Global configuration for the platform.</p></div>

      <Section title="General" onSave={() => saveSection("general")}>
        <Row label="Platform Name"><input className={input} value={form.general.platform_name ?? ""} onChange={(e) => set("general","platform_name", e.target.value)} /></Row>
        <Row label="Contact Email"><input className={input} value={form.general.contact_email ?? ""} onChange={(e) => set("general","contact_email", e.target.value)} /></Row>
        <Row label="Contact Phone"><input className={input} value={form.general.contact_phone ?? ""} onChange={(e) => set("general","contact_phone", e.target.value)} /></Row>
        <Row label="Default Language"><select className={input} value={form.general.default_language} onChange={(e) => set("general","default_language", e.target.value)}><option value="ar">Arabic</option><option value="en">English</option></select></Row>
        <Row label="Timezone"><input className={input} value={form.general.timezone} onChange={(e) => set("general","timezone", e.target.value)} /></Row>
      </Section>

      <Section title="Booking" onSave={() => saveSection("booking")}>
        <Row label="Booking interval (min)"><input type="number" className={input} value={form.booking.booking_interval_minutes} onChange={(e) => set("booking","booking_interval_minutes", Number(e.target.value))} /></Row>
        <Row label="Max booking window (days)"><input type="number" className={input} value={form.booking.max_booking_window_days} onChange={(e) => set("booking","max_booking_window_days", Number(e.target.value))} /></Row>
        <Row label="Grace period (min)"><input type="number" className={input} value={form.booking.grace_period_minutes} onChange={(e) => set("booking","grace_period_minutes", Number(e.target.value))} /></Row>
        <Row label="Cancellation window (min)"><input type="number" className={input} value={form.booking.cancellation_window_minutes} onChange={(e) => set("booking","cancellation_window_minutes", Number(e.target.value))} /></Row>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.booking.walkins_enabled} onChange={(e) => set("booking","walkins_enabled", e.target.checked)} /> Enable walk-ins</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.booking.reviews_enabled} onChange={(e) => set("booking","reviews_enabled", e.target.checked)} /> Enable reviews</label>
      </Section>

      <Section title="Authentication" onSave={() => saveSection("authentication")}>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.authentication.otp_enabled} onChange={(e) => set("authentication","otp_enabled", e.target.checked)} /> OTP Enabled</label>
        <Row label="OTP expiration (seconds)"><input type="number" className={input} value={form.authentication.otp_expiration_seconds} onChange={(e) => set("authentication","otp_expiration_seconds", Number(e.target.value))} /></Row>
        <Row label="Session timeout (hours)"><input type="number" className={input} value={form.authentication.session_timeout_hours} onChange={(e) => set("authentication","session_timeout_hours", Number(e.target.value))} /></Row>
      </Section>

      <Section title="Notifications" onSave={() => saveSection("notifications")}>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.notifications.email_enabled} onChange={(e) => set("notifications","email_enabled", e.target.checked)} /> Email enabled</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.notifications.announcements_enabled} onChange={(e) => set("notifications","announcements_enabled", e.target.checked)} /> Announcements enabled</label>
      </Section>

      <Section title="Maintenance" onSave={() => saveSection("maintenance")}>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.maintenance.enabled} onChange={(e) => set("maintenance","enabled", e.target.checked)} /> Enable maintenance mode</label>
        <Row label="Message"><textarea rows={3} className={input} value={form.maintenance.message ?? ""} onChange={(e) => set("maintenance","message", e.target.value)} /></Row>
      </Section>
    </div>
  );
}

function Section({ title, onSave, children }: { title: string; onSave: () => void; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-hairline bg-surface p-5">
      <div className="flex items-center justify-between"><h2 className="font-display text-lg">{title}</h2><button onClick={onSave} className="rounded-full bg-gold px-4 py-1.5 text-xs font-semibold text-primary-foreground">Save</button></div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs text-muted-foreground">{label}</span><div className="mt-1.5">{children}</div></label>;
}
