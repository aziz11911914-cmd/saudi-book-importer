import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { useAuth } from "@/lib/auth-provider";
import { useLocale } from "@/lib/locale-provider";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Qassah" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { t: tt, lng, toggle } = useLocale();
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-4xl tracking-tight text-foreground sm:text-5xl">
          {tt("Settings", "الإعدادات")}
        </h1>
        <div className="mt-8 space-y-3">
          <Row label={tt("Email", "البريد الإلكتروني")} value={user?.email ?? "—"} />
          <button
            type="button"
            onClick={toggle}
            className="flex w-full items-center justify-between rounded-2xl border border-hairline bg-surface px-4 py-4 text-sm hover:border-gold/40"
          >
            <span>{tt("Language", "اللغة")}</span>
            <span className="text-gold">{lng === "ar" ? "العربية" : "English"}</span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-between rounded-2xl border border-hairline bg-surface px-4 py-4 text-sm text-red-300 hover:border-red-500/40"
          >
            <span className="inline-flex items-center gap-2">
              <LogOut className="size-4" />
              {tt("Sign out", "تسجيل الخروج")}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-hairline bg-surface px-4 py-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}
