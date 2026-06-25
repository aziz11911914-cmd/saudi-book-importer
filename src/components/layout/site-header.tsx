import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/lib/locale-provider";
import { Languages, CalendarCheck, Heart, LogIn, User as UserIcon, LogOut, Settings, ChevronDown, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import logoUrl from "@/assets/qassah-logo.png";
import { useAuth, displayName } from "@/lib/auth-provider";
import { homeForRoles } from "@/lib/role-routing";

export function SiteHeader({ transparent = false }: { transparent?: boolean }) {
  const { t } = useTranslation();
  const { lng, toggle, t: tt } = useLocale();
  const { ready, user, profile, roles, signOut } = useAuth();
  const workspaceHome = homeForRoles(roles);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  async function handleSignOut() {
    setMenuOpen(false);
    await signOut();
    navigate({ to: "/", replace: true });
  }

  const initials = (() => {
    const name = displayName(profile, user?.email ?? "");
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
    return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  })();

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full border-b border-hairline backdrop-blur-md",
        transparent ? "bg-background/40" : "bg-background/85",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="group inline-flex items-center gap-2.5" aria-label="Home">
          <span className="relative inline-flex size-9 items-center justify-center rounded-full border border-gold/40 gold-hairline">
            <img src={logoUrl} alt="" width={36} height={36} className="size-6 object-contain" />
          </span>
          <span className="font-display text-xl font-semibold tracking-tight text-foreground">
            {t("brand")}
          </span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          <Link to="/barbers" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            {t("nav.barbers")}
          </Link>
          <span className="text-sm text-muted-foreground/50">·</span>
          <Link to="/" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            {t("nav.explore")}
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-gold/40 hover:text-foreground"
            aria-label="Switch language"
          >
            <Languages className="size-3.5" />
            <span dir={lng === "ar" ? "ltr" : "rtl"}>{t("nav.language")}</span>
          </button>

          {!ready ? (
            <span className="size-8 rounded-full border border-hairline" />
          ) : user ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-full border border-hairline pl-1 pr-2 py-1 text-xs text-foreground transition-colors hover:border-gold/40"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <span className="inline-flex size-7 items-center justify-center rounded-full bg-gold/15 text-[11px] font-semibold text-gold">
                  {initials}
                </span>
                <ChevronDown className="size-3 text-muted-foreground" />
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute end-0 mt-2 w-56 overflow-hidden rounded-2xl border border-hairline bg-surface shadow-xl"
                >
                  <div className="border-b border-hairline px-4 py-3 text-xs text-muted-foreground">
                    <div className="truncate text-foreground">
                      {displayName(profile, user.email ?? "")}
                    </div>
                    <div className="mt-0.5 truncate" dir="ltr">{user.email}</div>
                  </div>
                  <MenuItem to="/profile" icon={UserIcon} onClick={() => setMenuOpen(false)}>
                    {tt("Profile", "الملف الشخصي")}
                  </MenuItem>
                  <MenuItem to="/bookings" icon={CalendarCheck} onClick={() => setMenuOpen(false)}>
                    {tt("My bookings", "حجوزاتي")}
                  </MenuItem>
                  <MenuItem to="/favorites" icon={Heart} onClick={() => setMenuOpen(false)}>
                    {tt("Favorites", "المفضلة")}
                  </MenuItem>
                  <MenuItem to="/settings" icon={Settings} onClick={() => setMenuOpen(false)}>
                    {tt("Settings", "الإعدادات")}
                  </MenuItem>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-2 border-t border-hairline px-4 py-3 text-start text-sm text-red-300 hover:bg-red-500/5"
                  >
                    <LogOut className="size-4" />
                    {tt("Sign out", "تسجيل الخروج")}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/auth"
              className="inline-flex items-center gap-1.5 rounded-full bg-gold px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-gold-glow"
            >
              <LogIn className="size-3.5" />
              <span>{tt("Sign in", "تسجيل الدخول")}</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function MenuItem({
  to,
  icon: Icon,
  onClick,
  children,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to as "/"}
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-gold/5"
    >
      <Icon className="size-4 text-muted-foreground" />
      <span>{children}</span>
    </Link>
  );
}
