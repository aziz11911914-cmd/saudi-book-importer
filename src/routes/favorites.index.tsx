import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Heart, Trash2 } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { useLocale } from "@/lib/locale-provider";
import { toggleFavorite, useFavorites, type FavoriteType } from "@/lib/favorites-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/favorites/")({
  head: () => ({ meta: [{ title: "Favorites — Qassah" }] }),
  component: FavoritesPage,
});

type Tab = "all" | "shops" | "barbers" | "styles";
const TAB_TO_TYPE: Record<Tab, FavoriteType | null> = {
  all: null,
  shops: "shop",
  barbers: "barber",
  styles: "style",
};

function FavoritesPage() {
  const { t } = useTranslation();
  const { t: tt } = useLocale();
  const favorites = useFavorites();
  const [tab, setTab] = useState<Tab>("all");

  const filtered = tab === "all" ? favorites : favorites.filter((f) => f.type === TAB_TO_TYPE[tab]);

  return (
    <div className="min-h-screen bg-background pb-20">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 pt-10 sm:px-6">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {t("favorites.title")}
          </p>
          <h1 className="mt-2 font-display text-4xl tracking-tight text-foreground sm:text-5xl">
            {t("favorites.title")}
          </h1>
        </header>

        <div className="mb-6 flex gap-1 overflow-x-auto border-b border-hairline">
          {(Object.keys(TAB_TO_TYPE) as Tab[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={cn(
                "relative whitespace-nowrap px-4 py-3 text-sm transition-colors",
                tab === k ? "text-gold" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`favorites.tabs.${k}`)}
              {tab === k && <span className="absolute inset-x-3 bottom-0 h-px bg-gold" />}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-3xl border border-hairline bg-surface/60 p-12 text-center">
            <Heart className="mx-auto size-10 text-muted-foreground" />
            <h2 className="mt-4 font-display text-xl text-foreground">
              {t("favorites.empty")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("favorites.emptySub")}
            </p>
            <Link
              to="/"
              className="mt-6 inline-flex items-center rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-gold-glow"
            >
              {t("favorites.browse")}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {filtered.map((f) => {
              const title = tt(f.snapshot.title_en, f.snapshot.title_ar);
              const subtitle = tt(
                f.snapshot.subtitle_en ?? "",
                f.snapshot.subtitle_ar ?? "",
              );
              const inner = (
                <>
                  <div
                    className="aspect-[16/10] bg-cover bg-center"
                    style={{ backgroundImage: `url(${f.snapshot.image_url ?? ""})` }}
                  />
                  <div className="p-4">
                    <p className="line-clamp-1 text-sm font-medium text-foreground">{title}</p>
                    {subtitle && (
                      <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                        {subtitle}
                      </p>
                    )}
                    <p className="mt-2 inline-flex items-center gap-1 rounded-full border border-gold/30 px-2 py-0.5 text-[10px] uppercase tracking-wider text-gold">
                      {t(`favorites.tabs.${f.type === "shop" ? "shops" : f.type === "barber" ? "barbers" : "styles"}`)}
                    </p>
                  </div>
                </>
              );
              return (
                <div
                  key={`${f.type}-${f.id}`}
                  className="group relative overflow-hidden rounded-2xl border border-hairline bg-surface transition-all hover:border-gold/40"
                >
                  {f.type === "shop" ? (
                    <Link to="/shops/$slug" params={{ slug: f.id }} className="block">{inner}</Link>
                  ) : f.type === "barber" ? (
                    <Link to="/barbers/$barberId" params={{ barberId: f.id }} className="block">{inner}</Link>
                  ) : (
                    <Link to="/" className="block">{inner}</Link>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleFavorite({ type: f.type, id: f.id, snapshot: f.snapshot })}
                    aria-label="Remove"
                    className="absolute end-3 top-3 inline-flex size-9 items-center justify-center rounded-full border border-hairline bg-background/85 text-muted-foreground backdrop-blur transition-colors hover:border-gold/50 hover:text-gold"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
