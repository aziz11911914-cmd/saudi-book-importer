import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { MapPin, Search as SearchIcon } from "lucide-react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { SiteHeader } from "@/components/layout/site-header";
import { StarRating } from "@/components/star-rating";
import { useLocale } from "@/lib/locale-provider";
import { searchAll } from "@/lib/queries";
import { formatPrice } from "@/lib/format";

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/search")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({ meta: [{ title: "Search — Qassah" }] }),
  component: SearchPage,
});

function SearchPage() {
  const { q } = Route.useSearch();
  const navigate = useNavigate({ from: "/search" });
  const { t } = useTranslation();
  const { t: tt, lng } = useLocale();

  const [draft, setDraft] = useState(q);
  useEffect(() => setDraft(q), [q]);

  const { data, isLoading } = useQuery({
    queryKey: ["search", q],
    queryFn: () => searchAll(q),
    enabled: q.trim().length > 0,
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = draft.trim();
    navigate({ search: { q: next } });
  }

  const results = data ?? { barbers: [], shops: [], photos: [] };
  const total =
    results.barbers.length + results.shops.length + results.photos.length;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-3xl tracking-tight text-foreground sm:text-4xl">
          {t("search.title")}
        </h1>

        <form
          onSubmit={submit}
          className="mt-6 flex max-w-2xl items-center gap-2 rounded-full border border-hairline bg-surface/80 p-1.5 backdrop-blur"
        >
          <div className="flex flex-1 items-center gap-3 ps-4">
            <SearchIcon className="size-4 text-muted-foreground" />
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t("search.prompt")}
              autoFocus
              className="w-full bg-transparent py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-gold-glow"
          >
            {t("common.search") || t("search.title")}
          </button>
        </form>

        {q.trim() && (
          <p className="mt-4 text-sm text-muted-foreground">
            {t("search.for")}: <span className="text-foreground">"{q}"</span>
          </p>
        )}

        {isLoading && (
          <p className="mt-10 text-sm text-muted-foreground">{t("common.loading")}</p>
        )}

        {!isLoading && q.trim() && total === 0 && (
          <p className="mt-16 text-center text-sm text-muted-foreground">
            {t("search.empty")}
          </p>
        )}

        {/* Barbers */}
        {results.barbers.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-4 font-display text-xl text-foreground">
              {t("search.barbers")} ({results.barbers.length})
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {results.barbers.map((b) => (
                <Link
                  key={b.id}
                  to="/barbers/$barberId"
                  params={{ barberId: b.id }}
                  className="group flex gap-4 rounded-2xl border border-hairline bg-surface p-4 transition-all hover:border-gold/40"
                >
                  <div
                    className="size-20 shrink-0 rounded-xl bg-cover bg-center ring-1 ring-gold/20"
                    style={{ backgroundImage: `url(${b.photo_url})` }}
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-medium text-foreground">
                      {tt(b.display_name_en, b.display_name_ar)}
                    </h3>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {tt(b.shop?.name_en ?? "", b.shop?.name_ar ?? "")}
                    </p>
                    <div className="mt-2">
                      <StarRating value={Number(b.rating_avg)} count={b.rating_count} />
                    </div>
                    {b.shop && (
                      <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="size-3" />
                        {b.shop.district}, {b.shop.city}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Shops */}
        {results.shops.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-4 font-display text-xl text-foreground">
              {t("search.shops")} ({results.shops.length})
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {results.shops.map((s) => (
                <Link
                  key={s.id}
                  to="/shops/$slug"
                  params={{ slug: s.slug }}
                  className="group overflow-hidden rounded-2xl border border-hairline bg-surface transition-all hover:border-gold/40"
                >
                  <div
                    className="aspect-[16/10] bg-cover bg-center"
                    style={{ backgroundImage: `url(${s.cover_url ?? ""})` }}
                  />
                  <div className="p-4">
                    <h3 className="truncate font-medium text-foreground">
                      {tt(s.name_en, s.name_ar)}
                    </h3>
                    <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3" />
                      {s.district}, {s.city}
                    </p>
                    <div className="mt-2">
                      <StarRating value={Number(s.rating_avg)} count={s.rating_count} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Haircuts */}
        {results.photos.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-4 font-display text-xl text-foreground">
              {t("search.haircuts")} ({results.photos.length})
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {results.photos.map((p) => {
                const styleName =
                  p.portfolio_photo_specialties[0]?.specialty &&
                  tt(
                    p.portfolio_photo_specialties[0].specialty.label_en,
                    p.portfolio_photo_specialties[0].specialty.label_ar,
                  );
                const minPrice =
                  p.barber.barber_services.length > 0
                    ? Math.min(
                        ...p.barber.barber_services.map((bs) =>
                          Number(bs.service.price_sar),
                        ),
                      )
                    : null;
                return (
                  <Link
                    key={p.id}
                    to="/barbers/$barberId"
                    params={{ barberId: p.barber.id }}
                    className="group overflow-hidden rounded-2xl border border-hairline bg-surface transition-all hover:border-gold/40"
                  >
                    <div
                      className="aspect-square bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                      style={{ backgroundImage: `url(${p.url})` }}
                    />
                    <div className="p-3">
                      {styleName && (
                        <p className="truncate text-[11px] uppercase tracking-wider text-gold">
                          {styleName}
                        </p>
                      )}
                      <p className="mt-1 truncate text-sm text-foreground">
                        {tt(p.barber.display_name_en, p.barber.display_name_ar)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {tt(p.barber.shop.name_en, p.barber.shop.name_ar)}
                      </p>
                      {minPrice !== null && (
                        <p className="mt-1 text-xs font-semibold text-gold">
                          {t("service.from")} {t("service.sar")}{" "}
                          {formatPrice(minPrice, lng)}
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
