import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, LogOut } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { useAuth, displayName } from "@/lib/auth-provider";
import { useLocale } from "@/lib/locale-provider";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — Qassah" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { t: tt } = useLocale();
  const { profile, roles, user, refresh, signOut } = useAuth();
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState(profile?.first_name ?? "");
  const [lastName, setLastName] = useState(profile?.last_name ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFirstName(profile?.first_name ?? "");
    setLastName(profile?.last_name ?? "");
  }, [profile?.first_name, profile?.last_name]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    const full = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
    const { error: err } = await supabase
      .from("profiles")
      .update({
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        full_name: full || null,
      })
      .eq("id", user.id);
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSaved(true);
    await refresh();
  }

  async function handleLogout() {
    await signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-4xl tracking-tight text-foreground sm:text-5xl">
          {tt("Profile", "الملف الشخصي")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{displayName(profile, user?.email ?? "")}</p>

        <form
          onSubmit={save}
          className="mt-8 space-y-4 rounded-3xl border border-hairline bg-surface p-6"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">
                {tt("First name", "الاسم الأول")}
              </span>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                maxLength={60}
                className="mt-1.5 w-full rounded-2xl border border-hairline bg-background px-4 py-3 text-sm outline-none focus:border-gold/60"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">
                {tt("Last name", "الاسم الأخير")}
              </span>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                maxLength={60}
                className="mt-1.5 w-full rounded-2xl border border-hairline bg-background px-4 py-3 text-sm outline-none focus:border-gold/60"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">
              {tt("Email", "البريد الإلكتروني")}
            </span>
            <input
              type="email"
              value={user?.email ?? ""}
              disabled
              dir="ltr"
              className="mt-1.5 w-full rounded-2xl border border-hairline bg-background/50 px-4 py-3 text-sm text-muted-foreground"
            />
          </label>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{tt("Roles", "الصلاحيات")}:</span>
            {roles.length === 0 ? (
              <span>—</span>
            ) : (
              roles.map((r) => (
                <span
                  key={r}
                  className="rounded-full border border-gold/30 px-2 py-0.5 text-gold"
                >
                  {r}
                </span>
              ))
            )}
          </div>

          {error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-xs text-red-300">
              {error}
            </div>
          )}
          {saved && (
            <div className="rounded-2xl border border-gold/30 bg-gold/5 px-4 py-3 text-xs text-gold">
              {tt("Saved.", "تم الحفظ.")}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-gold-glow disabled:opacity-60"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {tt("Save changes", "حفظ التغييرات")}
          </button>
        </form>

        <div className="mt-8 grid grid-cols-2 gap-3">
          <Link
            to="/bookings"
            className="rounded-2xl border border-hairline bg-surface p-4 text-sm hover:border-gold/40"
          >
            {tt("My bookings", "حجوزاتي")}
          </Link>
          <Link
            to="/favorites"
            className="rounded-2xl border border-hairline bg-surface p-4 text-sm hover:border-gold/40"
          >
            {tt("Favorites", "المفضلة")}
          </Link>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <LogOut className="size-4" />
          {tt("Sign out", "تسجيل الخروج")}
        </button>
      </div>
    </div>
  );
}
