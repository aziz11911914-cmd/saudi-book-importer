import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-provider";
import { useState } from "react";
import {
  LayoutDashboard, CalendarCheck, Calendar, Users, Scissors, UserCircle,
  Sparkles, Image, Star, BarChart3, Store, Settings, LifeBuoy,
  LogOut, ShieldAlert, Menu, X, Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: any; exact?: boolean };
const NAV: NavItem[] = [
  { to: "/owner", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/owner/bookings", label: "Bookings", icon: CalendarCheck },
  { to: "/owner/calendar", label: "Calendar", icon: Calendar },
  { to: "/owner/customers", label: "Customers", icon: Users },
  { to: "/owner/barbers", label: "Barbers", icon: Scissors },
  { to: "/owner/services", label: "Services", icon: Sparkles },
  { to: "/owner/portfolio", label: "Portfolio", icon: Image },
  { to: "/owner/reviews", label: "Reviews", icon: Star },
  { to: "/owner/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/owner/public-page", label: "Public Page", icon: Globe },
  { to: "/owner/salon", label: "Salon", icon: Store },
  { to: "/owner/settings", label: "Settings", icon: Settings },
  { to: "/owner/support", label: "Support", icon: LifeBuoy },
];

export function OwnerLayout() {
  const { ready, roles, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const allowed = roles.includes("owner") || roles.includes("super_admin");

  if (!ready) {
    return <div className="grid min-h-screen place-items-center bg-background text-muted-foreground">Loading…</div>;
  }
  if (!allowed) {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-6 text-center">
        <div className="max-w-md space-y-4">
          <ShieldAlert className="mx-auto size-12 text-gold" />
          <h1 className="font-display text-3xl">Access Denied</h1>
          <p className="text-muted-foreground">You don't have permission to access the salon owner workspace.</p>
          <Link to="/" className="inline-block rounded-full bg-gold px-6 py-2 text-sm font-semibold text-primary-foreground">Back to home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <aside className={cn(
        "fixed inset-y-0 z-40 flex w-64 flex-col border-e border-hairline bg-surface/95 backdrop-blur transition-transform lg:static lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full",
      )}>
        <div className="flex h-16 items-center justify-between border-b border-hairline px-5">
          <Link to="/owner" className="font-display text-xl text-gold">Qassah Owner</Link>
          <button className="lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">
            <X className="size-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to as any}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
                  active ? "bg-gold/10 text-gold" : "text-muted-foreground hover:bg-surface hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-hairline p-3">
          <Link to="/profile" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-surface hover:text-foreground">
            <UserCircle className="size-4" /> {profile?.full_name || profile?.email || "Profile"}
          </Link>
          <button
            onClick={async () => { await signOut(); navigate({ to: "/auth", replace: true }); }}
            className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-surface hover:text-foreground"
          >
            <LogOut className="size-4" /> Logout
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-hairline bg-background/80 px-4 backdrop-blur sm:px-6">
          <button className="lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar">
            <Menu className="size-5" />
          </button>
          <div className="flex-1" />
          <Link
            to="/owner"
            className="relative rounded-full p-2 text-muted-foreground hover:bg-surface hover:text-foreground"
            aria-label="Notifications"
          >
            <Bell className="size-5" />
          </Link>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
