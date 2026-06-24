import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  Share2,
  Clock,
} from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SpecialtyChip } from "@/components/specialty-chip";
import { StarRating } from "@/components/star-rating";
import { PortfolioLightbox } from "@/components/portfolio-lightbox";
import { FavoriteButton } from "@/components/favorite-button";
import { ReviewsList } from "@/components/reviews-list";
import { useLocale } from "@/lib/locale-provider";
import { fetchBarberFull, fetchBarberReviews, type PortfolioCard } from "@/lib/queries";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/barbers/$barberId")({
  head: ({ params }) => ({
    meta: [
      { title: `Barber — Qassah` },
      { name: "description", content: `Barber portfolio and booking on Qassah.` },
      { property: "og:title", content: `Barber — Qassah` },
      {
        property: "og:description",
        content: `Browse this barber's portfolio and book your next cut.`,
      },
    ],
  }),
  component: BarberProfilePage,
});

type Tab = "about" | "services" | "portfolio" | "reviews";

function BarberProfilePage() {
  const { barberId } = Route.useParams();
  const { t } = useTranslation();
  const { t: tt, rtl, lng } = useLocale();
  const router = useRouter();
  const navigate = useNavigate();
  const ArrowBack = rtl ? ArrowRight : ArrowLeft;

  const [tab, setTab] = useState<Tab>("about");
  const [filterSlug, setFilterSlug] = useState<string>("all");
  const [lightbox, setLightbox] = useState<number | null>(null);

  const { data: barber, isLoading } = useQuery({
    queryKey: ["barber", barberId],
    queryFn: () => fetchBarberFull(barberId),
  });
  const { data: reviews = [] } = useQuery({
    queryKey: ["barber-reviews", barberId],
    queryFn: () => fetchBarberReviews(barberId),
  });

  const lightboxItems: PortfolioCard[] = useMemo(() => {
    if (!barber) return [];
    const filtered =
      filterSlug === "all"
        ? barber.portfolio_photos
        : barber.portfolio_photos.filter((p) =>
            p.portfolio_photo_specialties.some(
              (s) => s.specialty.slug === filterSlug,
            ),
          );
    return filtered.map((p) => ({
      ...p,
      barber: {
        id: barber.id,
        display_name_en: barber.display_name_en,
        display_name_ar: barber.display_name_ar,
        photo_url: barber.photo_url,
        rating_avg: barber.rating_avg,
        rating_count: barber.rating_count,
        shop: {
          id: barber.shop.id,
          name_en: barber.shop.name_en,
          name_ar: barber.shop.name_ar,
          city: barber.shop.city ?? "",
          district: barber.shop.district ?? "",
        },
        barber_services: barber.barber_services.map((bs) => ({
          service: {
            id: bs.service.id,
            name_en: bs.service.name_en,
            name_ar: bs.service.name_ar,
            price_sar: bs.service.price_sar,
            duration_min: bs.service.duration_min,
          },
        })),
      },
    })) as PortfolioCard[];
  }, [barber, filterSlug]);
  const photos = lightboxItems;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="mx-auto max-w-3xl px-4 py-20 text-center text-sm text-muted-foreground">
          {t("common.loading")}
        </div>
      </div>
    );
  }
  if (!barber) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="mx-auto max-w-3xl px-4 py-20 text-center text-sm text-muted-foreground">
          {t("common.empty")}
        </div>
      </div>
    );
  }

  const name = tt(barber.display_name_en, barber.display_name_ar);
  const title = tt(barber.title_en, barber.title_ar);
  const shopName = tt(barber.shop.name_en, barber.shop.name_ar);
  const bio = tt(barber.bio_en ?? "", barber.bio_ar ?? "");

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Top bar — minimal, dark, gold accents */}
      <div className="sticky top-0 z-40 border-b border-hairline bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-3">
          <button
            type="button"
            onClick={() => router.history.back()}
            className="inline-flex size-9 items-center justify-center rounded-full border border-hairline text-foreground transition-colors hover:border-gold/50"
            aria-label={t("common.back")}
          >
            <ArrowBack className="size-4" />
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex size-9 items-center justify-center rounded-full border border-hairline text-foreground transition-colors hover:border-gold/50"
              aria-label={t("barber.share")}
            >
              <Share2 className="size-4" />
            </button>
            <FavoriteButton
              type="barber"
              id={barberId}
              snapshot={{
                title_en: barber!.display_name_en,
                title_ar: barber!.display_name_ar,
                subtitle_en: barber!.shop.name_en,
                subtitle_ar: barber!.shop.name_ar,
                image_url: barber!.photo_url,
              }}
            />
          </div>
        </div>
      </div>

      {/* Identity */}
      <section className="relative mx-auto max-w-3xl px-4 pt-10">
        <div className="flex flex-col items-center text-center">
          <div className="relative">
            <div className="absolute inset-0 -m-1 rounded-full gradient-gold opacity-80 blur-[1px]" />
            <img
              src={barber.photo_url ?? ""}
              alt={name}
              className="relative size-32 rounded-full object-cover ring-1 ring-gold/60"
            />
          </div>
          <h1 className="mt-5 font-display text-4xl tracking-tight text-foreground sm:text-5xl">
            {name}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{title}</p>
          <Link
            to="/shops/$slug"
            params={{ slug: barber.shop.slug }}
            className="mt-1 text-xs text-gold hover:underline"
          >
            {shopName}
          </Link>
          <div className="mt-3">
            <StarRating value={Number(barber.rating_avg)} count={barber.rating_count} size="md" />
          </div>
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="size-3" />
            {barber.shop.district}, {barber.shop.city}
          </p>
          <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/5 px-3 py-1 text-xs text-gold gold-hairline">
            <span className="size-1.5 rounded-full bg-gold" />
            {t("barber.availableToday")}
          </span>
        </div>

        {/* Quick stats */}
        <div className="mt-8 grid grid-cols-3 divide-x divide-hairline rounded-2xl border border-hairline bg-surface/60 text-center rtl:divide-x-reverse">
          <Stat
            value={barber.appointments_completed.toLocaleString()}
            label={t("barber.appointmentsCompleted")}
          />
          <Stat
            value={barber.clients_served.toLocaleString()}
            label={t("barber.clientsServed")}
          />
          <Stat
            value={barber.years_experience.toString()}
            label={t("barber.yearsExperience")}
          />
        </div>

        {/* Specialties */}
        <div className="mt-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {t("barber.specialties")}
          </p>
          <div className="flex flex-wrap gap-2">
            {barber.barber_specialties.map((bs) => (
              <SpecialtyChip key={bs.specialty.id}>
                {tt(bs.specialty.label_en, bs.specialty.label_ar)}
              </SpecialtyChip>
            ))}
          </div>
        </div>
      </section>

      {/* Tabs */}
      <section className="sticky top-14 z-30 mt-8 border-y border-hairline bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-2">
          {(["about", "services", "portfolio", "reviews"] as Tab[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={cn(
                "relative whitespace-nowrap px-4 py-3.5 text-sm transition-colors",
                tab === k ? "text-gold" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`barber.tabs.${k}`)}
              {tab === k && (
                <span className="absolute inset-x-3 bottom-0 h-px bg-gold" />
              )}
            </button>
          ))}
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 pt-8">
        {tab === "about" && (
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            {bio ? <p>{bio}</p> : <p>{t("common.empty")}</p>}
          </div>
        )}

        {tab === "services" && (
          <div className="space-y-3">
            {barber.barber_services.map(({ service: s }) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-hairline bg-surface p-4"
              >
                <div className="min-w-0">
                  <h3 className="truncate font-medium text-foreground">
                    {tt(s.name_en, s.name_ar)}
                  </h3>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="size-3" />
                    {s.duration_min} {t("service.min")}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-foreground">
                    {t("service.sar")} {formatPrice(s.price_sar, lng)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    navigate({
                      to: "/book/$barberId",
                      params: { barberId: barber.id },
                      search: { service: s.id, step: "date" } as never,
                    })
                  }
                  className="shrink-0 rounded-full border border-gold/50 px-4 py-2 text-xs font-medium text-gold transition-colors hover:bg-gold hover:text-primary-foreground"
                >
                  {t("service.book")}
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === "portfolio" && (
          <div>
            {/* In-portfolio filter chips */}
            <div className="mb-4 flex flex-wrap gap-2">
              <SpecialtyChip
                size="sm"
                active={filterSlug === "all"}
                onClick={() => setFilterSlug("all")}
              >
                {t("specialties.all")}
              </SpecialtyChip>
              {barber.barber_specialties.map((bs) => (
                <SpecialtyChip
                  key={bs.specialty.id}
                  size="sm"
                  active={filterSlug === bs.specialty.slug}
                  onClick={() => setFilterSlug(bs.specialty.slug)}
                >
                  {tt(bs.specialty.label_en, bs.specialty.label_ar)}
                </SpecialtyChip>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {photos.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setLightbox(i)}
                  className="group relative aspect-square overflow-hidden rounded-md bg-surface"
                >
                  <img
                    src={p.url}
                    alt={tt(p.caption_en ?? "", p.caption_ar ?? "")}
                    className="size-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                </button>
              ))}
              {photos.length === 0 && (
                <p className="col-span-full py-12 text-center text-sm text-muted-foreground">
                  {t("common.empty")}
                </p>
              )}
            </div>
          </div>
        )}

        {tab === "reviews" && <ReviewsList reviews={reviews} />}
      </div>

      {/* Lightbox */}
      {lightbox !== null && lightboxItems[lightbox] && (
        <PortfolioLightbox
          items={lightboxItems}
          index={lightbox}
          onChange={setLightbox}
          onClose={() => setLightbox(null)}
        />
      )}

      {/* Sticky book bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-xs text-muted-foreground">{t("service.from")}</p>
            <p className="text-sm font-semibold text-foreground">
              {t("service.sar")}{" "}
              {formatPrice(
                Math.min(
                  ...(barber.barber_services.map((bs) => Number(bs.service.price_sar)) || [
                    0,
                  ]),
                ),
                lng,
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              navigate({ to: "/book/$barberId", params: { barberId: barber.id } })
            }
            className="inline-flex flex-1 items-center justify-center rounded-full bg-gold px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-gold-glow"
          >
            {t("barber.bookNow")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-3 py-4">
      <p className="font-display text-2xl text-gold">{value}</p>
      <p className="mt-1 text-xs leading-tight text-muted-foreground">{label}</p>
    </div>
  );
}
