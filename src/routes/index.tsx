import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, MapPin, Search } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SpecialtyChip } from "@/components/specialty-chip";
import { StarRating } from "@/components/star-rating";
import { PortfolioLightbox } from "@/components/portfolio-lightbox";
import { useLocale } from "@/lib/locale-provider";
import {
  fetchFeaturedBarbers,
  fetchFeaturedShops,
  fetchPortfolioFeed,
  fetchSpecialties,
  type PortfolioCard,
} from "@/lib/queries";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { t } = useTranslation();
  const { lng, rtl, t: tt } = useLocale();
  const ArrowEnd = rtl ? ArrowLeft : ArrowRight;
  const navigate = useNavigate({ from: "/" });
  const [searchDraft, setSearchDraft] = useState("");

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchDraft.trim();
    if (!q) {
      navigate({ to: "/barbers" });
      return;
    }
    navigate({ to: "/search", search: { q } });
  }


  const { data: specialties = [] } = useQuery({
    queryKey: ["specialties"],
    queryFn: fetchSpecialties,
  });
  const { data: featured = [] } = useQuery({
    queryKey: ["featured-barbers"],
    queryFn: fetchFeaturedBarbers,
  });
  const { data: shops = [] } = useQuery({
    queryKey: ["featured-shops"],
    queryFn: fetchFeaturedShops,
  });
  const { data: latest = [] } = useQuery({
    queryKey: ["portfolio-feed", "latest"],
    queryFn: () => fetchPortfolioFeed("latest", 24),
  });
  const { data: trending = [] } = useQuery({
    queryKey: ["portfolio-feed", "trending"],
    queryFn: () => fetchPortfolioFeed("trending", 24),
  });

  const [activeSpecialty, setActiveSpecialty] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ items: PortfolioCard[]; index: number } | null>(null);

  const filterBySpec = (items: PortfolioCard[]) =>
    !activeSpecialty
      ? items
      : items.filter((it) =>
          it.portfolio_photo_specialties.some(
            (p) => p.specialty?.slug === activeSpecialty,
          ),
        );

  const filteredTrending = useMemo(() => filterBySpec(trending), [trending, activeSpecialty]);
  const filteredLatest = useMemo(() => filterBySpec(latest), [latest, activeSpecialty]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader transparent />

      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div
            className="absolute inset-x-0 top-0 h-[520px] bg-cover bg-center opacity-25"
            style={{
              backgroundImage: "url(/haircuts/skin-fade-high-volume.jpg)",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/85 to-background" />
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-12 pt-20 sm:px-6 sm:pt-28">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-gold/30 px-3 py-1 text-xs text-gold">
            <span className="size-1.5 rounded-full bg-gold" />
            {t("tagline")}
          </p>
          <h1 className="font-display text-5xl leading-[1.05] tracking-tight text-foreground sm:text-7xl">
            {t("home.heroTitle")}
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            {t("home.heroSubtitle")}
          </p>

          {/* Search */}
          <form
            onSubmit={submitSearch}
            className="mt-8 flex max-w-2xl items-center gap-2 rounded-full border border-hairline bg-surface/80 p-1.5 backdrop-blur gold-hairline"
          >
            <div className="flex flex-1 items-center gap-3 ps-4">
              <Search className="size-4 text-muted-foreground" />
              <input
                type="text"
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                placeholder={t("home.searchPlaceholder")}
                className="w-full bg-transparent py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-gold-glow"
            >
              {t("home.ctaBrowse")}
              <ArrowEnd className="ms-2 size-4" />
            </button>
          </form>

        </div>
      </section>

      {/* Style filter chips (filters haircut sections) */}
      <section className="mx-auto max-w-6xl px-4 pt-2 sm:px-6">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {t("home.sectionByLook")}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveSpecialty(null)}
            className={
              !activeSpecialty
                ? "rounded-full border border-gold bg-gold/10 px-3.5 py-1.5 text-xs font-medium text-gold"
                : "rounded-full border border-hairline bg-surface px-3.5 py-1.5 text-xs text-muted-foreground hover:border-gold/40 hover:text-foreground"
            }
          >
            {t("home.allStyles")}
          </button>
          {specialties.map((s) => {
            const active = activeSpecialty === s.slug;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveSpecialty(active ? null : s.slug)}
              >
                <SpecialtyChip active={active}>
                  {tt(s.label_en, s.label_ar)}
                </SpecialtyChip>
              </button>
            );
          })}
        </div>
      </section>

      {/* Trending Haircuts */}
      <section className="mx-auto max-w-6xl px-4 pt-12 sm:px-6">
        <SectionHeader title={t("home.sectionTrending")} />
        {filteredTrending.length === 0 ? (
          <EmptyHaircuts t={t} />
        ) : (
          <PhotoGrid
            items={filteredTrending.slice(0, 8)}
            onOpen={(i) => setLightbox({ items: filteredTrending, index: i })}
            lng={lng}
            tt={tt}
          />
        )}
      </section>

      {/* Latest Haircuts */}
      <section className="mx-auto max-w-6xl px-4 pt-16 sm:px-6">
        <SectionHeader title={t("home.sectionLatest")} />
        {filteredLatest.length === 0 ? (
          <EmptyHaircuts t={t} />
        ) : (
          <PhotoGrid
            items={filteredLatest}
            onOpen={(i) => setLightbox({ items: filteredLatest, index: i })}
            lng={lng}
            tt={tt}
          />
        )}
      </section>

      {/* Barbers */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <SectionHeader title={t("home.sectionFeatured")} link="/barbers" linkLabel={t("home.seeAll")} />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {featured.slice(0, 8).map((b) => (
            <Link
              key={b.id}
              to="/barbers/$barberId"
              params={{ barberId: b.id }}
              className="group block overflow-hidden rounded-2xl border border-hairline bg-surface transition-all hover:border-gold/40 hover:gold-glow"
            >
              <div
                className="aspect-[4/5] bg-cover bg-center transition-transform duration-500 group-hover:scale-[1.03]"
                style={{ backgroundImage: `url(${b.photo_url})` }}
              />
              <div className="p-3">
                <h3 className="line-clamp-1 text-sm font-medium text-foreground">
                  {tt(b.display_name_en, b.display_name_ar)}
                </h3>
                <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                  {tt(b.shop?.name_en ?? "", b.shop?.name_ar ?? "")}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <StarRating value={Number(b.rating_avg)} count={b.rating_count} size="sm" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Shops */}
      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <SectionHeader title={t("home.sectionShops")} />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {shops.map((s) => (
            <Link
              key={s.id}
              to="/shops/$slug"
              params={{ slug: s.slug }}
              className="group block overflow-hidden rounded-3xl border border-hairline bg-surface transition-all hover:border-gold/40"
            >
              <div className="relative">
                <div
                  className="h-52 bg-cover bg-center transition-transform duration-500 group-hover:scale-[1.02]"
                  style={{ backgroundImage: `url(${s.cover_url})` }}
                />
                {s.featured && (
                  <span className="absolute start-3 top-3 rounded-full bg-background/85 px-2.5 py-1 text-[10px] uppercase tracking-wider text-gold backdrop-blur">
                    ★
                  </span>
                )}
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-xl text-foreground">
                      {tt(s.name_en, s.name_ar)}
                    </h3>
                    <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="size-3" />
                      {s.district}, {s.city}
                    </p>
                  </div>
                  <StarRating value={Number(s.rating_avg)} count={s.rating_count} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <footer className="border-t border-hairline">
        <div className="mx-auto max-w-6xl px-4 py-8 text-center text-xs text-muted-foreground sm:px-6">
          © {new Date().getFullYear()} · {lng === "ar" ? "قَصّة" : "Qassah"}
        </div>
      </footer>

      {lightbox && (
        <PortfolioLightbox
          items={lightbox.items}
          index={lightbox.index}
          onChange={(i) => setLightbox({ ...lightbox, index: i })}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}

function SectionHeader({
  title,
  link,
  linkLabel,
}: {
  title: string;
  link?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-6 flex items-end justify-between">
      <h2 className="font-display text-3xl tracking-tight text-foreground sm:text-4xl">
        {title}
      </h2>
      {link && linkLabel && (
        <Link to={link} className="text-sm text-gold hover:underline">
          {linkLabel}
        </Link>
      )}
    </div>
  );
}

function EmptyHaircuts({ t }: { t: (k: string) => string }) {
  return (
    <div className="rounded-2xl border border-hairline bg-surface/40 p-10 text-center text-sm text-muted-foreground">
      {t("home.noStyleResults")}
    </div>
  );
}

function HaircutCard({
  item,
  onOpen,
  lng,
  tt,
}: {
  item: PortfolioCard;
  onOpen: () => void;
  lng: string;
  tt: (en: string, ar: string) => string;
}) {
  const { t } = useTranslation();
  const styleNameEn = item.caption_en ?? "";
  const styleNameAr = item.caption_ar ?? "";
  const price =
    item.starting_price_sar ??
    (item.barber.barber_services.length > 0
      ? Math.min(...item.barber.barber_services.map((bs) => Number(bs.service.price_sar)))
      : null);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col overflow-hidden rounded-2xl border border-hairline bg-surface text-start transition-all hover:border-gold/40"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-surface">
        <img
          src={item.url}
          alt={tt(styleNameEn, styleNameAr)}
          loading="lazy"
          onError={(e) => {
            const img = e.currentTarget;
            img.src = "/haircuts/skin-fade.jpg";
          }}
          className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <span className="absolute end-2 top-2 rounded-full bg-gold/95 px-2.5 py-1 text-[10px] font-semibold text-primary-foreground opacity-0 transition-opacity group-hover:opacity-100">
          {t("barber.bookThisLook")}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-1 text-sm font-semibold text-foreground">
          {tt(styleNameEn, styleNameAr)}
        </h3>
        <p className="line-clamp-1 text-xs text-muted-foreground">
          {tt(item.barber.display_name_en, item.barber.display_name_ar)}
        </p>
        <p className="line-clamp-1 text-xs text-muted-foreground">
          {tt(item.barber.shop?.name_en ?? "", item.barber.shop?.name_ar ?? "")}
        </p>
        {price !== null && (
          <p className="mt-1 text-xs text-gold">
            {t("service.from")} {t("service.sar")} {formatPrice(price, lng)}
          </p>
        )}
      </div>
    </button>
  );
}

function PhotoGrid({
  items,
  onOpen,
  lng,
  tt,
}: {
  items: PortfolioCard[];
  onOpen: (i: number) => void;
  lng: string;
  tt: (en: string, ar: string) => string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((it, i) => (
        <HaircutCard key={it.id} item={it} onOpen={() => onOpen(i)} lng={lng} tt={tt} />
      ))}
    </div>
  );
}
