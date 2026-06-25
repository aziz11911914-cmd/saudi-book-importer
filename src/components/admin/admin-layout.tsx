import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-provider";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Store, Users, Scissors, UserCircle, CalendarCheck,
  Star, BarChart3, Bell, Settings, ShieldAlert, LogOut, Search, Plus, Menu, X,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { adminGlobalSearch } from "@/lib/admin.functions";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: any; exact?: boolean };
const NAV: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/salons", label: "Salons", icon: Store },
  { to: "/admin/owners", label: "Owners", icon: UserCircle },
  { to: "/admin/barbers", label: "Barbers", icon: Scissors },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/bookings", label: "Bookings", icon: CalendarCheck },
  { to: "/admin/reviews", label: "Reviews", icon: Star },
  { to: "/admin/reports", label: "Reports", icon: BarChart3 },
  { to: "/admin/notifications", label: "Notifications", icon: Bell },
  { to: "/admin/settings", label: "Settings", icon: Settings },
  { to: "/admin/audit-logs", label: "Audit Logs", icon: ShieldAlert },
];

export function AdminLayout({ requireRole = "super_admin" as "super_admin" | "owner" | "barber" }: { requireRole?: "super_admin" | "owner" | "barber" }) {
  const { ready, roles, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const allowed = roles.includes(requireRole);

  useEffect(() => {
    if (ready && !allowed) {
      // Show access denied inline
    }
  }, [ready, allowed]);

  if (!ready) {
    return <div className="grid min-h-screen place-items-center bg-background text-muted-foreground">Loading…</div>;
  }
  if (!allowed) {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-6 text-center">
        <div className="max-w-md space-y-4">
          <ShieldAlert className="mx-auto size-12 text-gold" />
          <h1 className="font-display text-3xl">Access Denied</h1>
          <p className="text-muted-foreground">You don't have permission to view this page.</p>
          <Link to="/" className="inline-block rounded-full bg-gold px-6 py-2 text-sm font-semibold text-primary-foreground">Back to home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 z-40 flex w-64 flex-col border-e border-hairline bg-surface/95 backdrop-blur transition-transform lg:static lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full",
      )}>
        <div className="flex h-16 items-center justify-between border-b border-hairline px-5">
          <Link to="/admin" className="font-display text-xl text-gold">Qassah Admin</Link>
          <button className="lg:hidden" onClick={() => setSidebarOpen(false)}><X className="size-5" /></button>
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
          <button onClick={async () => { await signOut(); navigate({ to: "/auth", replace: true }); }} className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-surface hover:text-foreground">
            <LogOut className="size-4" /> Logout
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [results, setResults] = useState<any>(null);
  const search = useServerFn(adminGlobalSearch);
  const navigate = useNavigate();

  useEffect(() => {
    if (!q || q.length < 2) { setResults(null); return; }
    const t = setTimeout(async () => {
      try { setResults(await search({ data: { q } })); setOpen(true); } catch {}
    }, 200);
    return () => clearTimeout(t);
  }, [q, search]);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-hairline bg-background/80 px-4 backdrop-blur sm:px-6">
      <button className="lg:hidden" onClick={onMenuClick}><Menu className="size-5" /></button>
      <div className="relative flex-1 max-w-xl">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder="Search salons, owners, barbers, bookings…"
          className="w-full rounded-full border border-hairline bg-surface ps-10 pe-4 py-2 text-sm outline-none focus:border-gold/60"
        />
        {open && results && (
          <div className="absolute inset-x-0 top-full mt-2 max-h-[60vh] overflow-y-auto rounded-2xl border border-hairline bg-surface p-2 shadow-xl">
            {(["salons","barbers","users","bookings"] as const).map((key) => (
              results[key]?.length > 0 && (
                <div key={key} className="mb-2">
                  <div className="px-3 py-1 text-[10px] uppercase text-muted-foreground">{key}</div>
                  {results[key].map((r: any) => (
                    <button
                      key={r.id}
                      onMouseDown={() => {
                        setOpen(false); setQ("");
                        if (key === "salons") navigate({ to: "/admin/salons/$id" as any, params: { id: r.id } as any });
                        if (key === "barbers") navigate({ to: "/admin/barbers" as any });
                        if (key === "users") navigate({ to: "/admin/customers" as any });
                        if (key === "bookings") navigate({ to: "/admin/bookings" as any });
                      }}
                      className="block w-full rounded-lg px-3 py-2 text-start text-sm hover:bg-background"
                    >
                      {r.name_en || r.display_name_en || r.full_name || r.email || r.booking_ref}
                    </button>
                  ))}
                </div>
              )
            ))}
            {results.salons.length + results.barbers.length + results.users.length + results.bookings.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">No results</div>
            )}
          </div>
        )}
      </div>

      <div className="relative">
        <button
          onClick={() => setCreateOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-gold-glow"
        >
          <Plus className="size-4" /> Create
        </button>
        {createOpen && (
          <div className="absolute end-0 top-full z-10 mt-2 w-56 overflow-hidden rounded-2xl border border-hairline bg-surface shadow-xl">
            {[
              { label: "Create Salon", to: "/admin/salons/new" },
              { label: "Create Owner", to: "/admin/owners" },
              { label: "Create Barber", to: "/admin/barbers" },
              { label: "Send Notification", to: "/admin/notifications" },
            ].map((m) => (
              <button
                key={m.to}
                onMouseDown={() => { setCreateOpen(false); navigate({ to: m.to as any }); }}
                className="block w-full px-4 py-2 text-start text-sm hover:bg-background"
              >
                {m.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
