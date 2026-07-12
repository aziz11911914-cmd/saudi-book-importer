import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth-provider";
import { useState } from "react";
import {
  LayoutDashboard,
  CalendarCheck,
  UserCircle,
  Settings,
  LogOut,
  ShieldAlert,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "@/components/admin/language-switcher";

type NavItem = { to: string; key: string; icon: any; exact?: boolean };
const NAV: NavItem[] = [
  { to: "/barber", key: "dashboard", icon: LayoutDashboard, exact: true },
  { to: "/barber/bookings", key: "bookings", icon: CalendarCheck },
  { to: "/barber/profile", key: "profile", icon: UserCircle },
  { to: "/barber/settings", key: "settings", icon: Settings },
];

export function BarberLayout() {
  const { ready, roles, profile, signOut } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const allowed = roles.includes("barber") || roles.includes("super_admin");

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-muted-foreground">
        {t("admin.common.loading")}
      </div>
    );
  }
  if (!allowed) {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-6 text-center">
        <div className="max-w-md space-y-4">
          <ShieldAlert className="mx-auto size-12 text-gold" />
          <h1 className="font-display text-3xl">Access Denied</h1>
          <Link
            to="/"
            className="inline-block rounded-full bg-gold px-6 py-2 text-sm font-semibold text-primary-foreground"
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <aside
        className={cn(
          "fixed inset-y-0 z-40 flex w-64 flex-col border-e border-hairline bg-surface/95 backdrop-blur transition-transform lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-hairline px-5">
          <Link to="/barber" className="font-display text-xl text-gold">
            {t("barber.brand")}
          </Link>
          <button
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV.map((item) => {
            const active = item.exact
              ? pathname === item.to
              : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to as any}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
                  active
                    ? "bg-gold/10 text-gold"
                    : "text-muted-foreground hover:bg-surface hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                <span>{t(`barber.nav.${item.key}`)}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-hairline p-3">
          <div className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground">
            <UserCircle className="size-4" />
            <span className="truncate">
              {profile?.full_name || profile?.email}
            </span>
          </div>
          <button
            onClick={async () => {
              await signOut();
              navigate({ to: "/auth", replace: true });
            }}
            className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-surface hover:text-foreground"
          >
            <LogOut className="size-4" /> {t("barber.nav.logout")}
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-hairline bg-background/80 px-4 backdrop-blur sm:px-6">
          <button
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Menu"
          >
            <Menu className="size-5" />
          </button>
          <div className="flex-1" />
          <LanguageSwitcher />
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
