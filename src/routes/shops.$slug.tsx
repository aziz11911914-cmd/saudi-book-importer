import { createFileRoute, Link, notFound, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  MapPin,
  Phone,
  Share2,
  Star,
} from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { StarRating } from "@/components/star-rating";
import { FavoriteButton } from "@/components/favorite-button";
import { MapPreview } from "@/components/map-preview";
import { ReviewsList } from "@/components/reviews-list";
import { useLocale } from "@/lib/locale-provider";
import { fetchShopBySlug, fetchShopReviews } from "@/lib/queries";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/shops/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `Shop — Qassah` },
      { name: "description", content: `Shop profile and booking on Qassah.` },
      { property: "og:title", content: `Shop — Qassah` },
      {
        property: "og:description",
        content: `Browse this shop's services, team, and reviews.`,
      },
    ],
  }),
  component: ShopProfilePage,
});

type Tab = "photos" | "about" | "services" | "team" | "reviews";

function ShopProfilePage() {
  const { slug } = Route.useParams();
  const { t } = useTranslation();
  const { t: tt, lng, rtl } = useLocale();
  const router = useRouter();
  const navigate = useNavigate();
  const ArrowBack = rtl ? ArrowRight : ArrowLeft;
  const [tab, setTab] = useState<Tab>("photos");
  const [expanded, setExpanded] = useState(false);

  const { data: shop, isLoading } = useQuery({
    queryKey: ["shop", slug],
    queryFn: () => fetchShopBySlug(slug),
  });
  const { data: reviews = [] } = useQuery({
    queryKey: ["shop-reviews", shop?.id],
    queryFn: () => fetchShopReviews(shop!.id),
    enabled: !!shop?.id,
  });

  const todayHours = useMemo(() => {
    if (!shop) return null;
    const today = new Date().getDay();
    return shop.shop_hours.find((h) => h.day_of_week === today) ?? null;
  }, [shop]);

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
  if (!shop) throw notFound();

  const name = tt(shop.name_en, shop.name_ar);
  const description = tt(shop.description_en ?? "", shop.description_ar ?? "");
  const gallery = shop.shop_photos.length > 0
    ? shop.shop_photos.map((p) => p.url)
    : shop.cover_url
      ? [shop.cover_url]
      : [];
  const minPrice = shop.services.length > 0
    ? Math.min(...shop.services.map((s) => Number(s.price_sar)))
    : null;

  function startBooking(serviceId?: string) {
    navigate({
      to: "/book/shop/$shopSlug",
      params: { shopSlug: slug },
      search: serviceId ? { service: serviceId } as never : undefined,
    });
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Top bar */}
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
              aria-label={t("shop.share")}
            >
              <Share2 className="size-4" />
            </button>
            <FavoriteButton
              type="shop"
              id={shop.slug}
              snapshot={{
                title_en: shop.name_en,
                title_ar: shop.name_ar,
                subtitle_en: `${shop.district ?? ""}, ${shop.city ?? ""}`,
                subtitle_ar: `${shop.district ?? ""}, ${shop.city ?? ""}`,
                image_url: shop.cover_url ?? gallery[0],
              }}
            />
          </div>
        </div>
      </div>

      {/* Cover gallery */}
      <section className="relative">
        <div
          className="h-72 bg-cover bg-center sm:h-96"
          style={{ backgroundImage: `url(${gallery[0] ?? ""})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        {gallery.length > 1 && (
          <span className="absolute end-4 top-4 rounded-full bg-background/85 px-3 py-1 text-xs text-foreground backdrop-blur">
            1/{gallery.length}
          </span>
        )}
      </section>

      {/* Header card */}
      <section className="mx-auto -mt-16 max-w-3xl px-4 sm:px-6">
        <div className="rounded-3xl border border-hairline bg-surface/95 p-6 backdrop-blur sm:p-8">
          <h1 className="font-display text-3xl tracking-tight text-foreground sm:text-4xl">
            {name}
          </h1>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {t("barber.title")}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <StarRating value={Number(shop.rating_avg)} count={shop.rating_count} size="md" />
            {todayHours ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 px-3 py-1 text-xs text-gold">
                <Clock className="size-3" />
                {t("shop.openUntil")} {todayHours.closes_at.slice(0, 5)}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-3 py-1 text-xs text-muted-foreground">
                <Clock className="size-3" />
                {t("shop.closedToday")}
              </span>
            )}
          </div>
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-2xl border border-hairline bg-background/50 px-4 py-2 text-xs text-muted-foreground">
            <MapPin className="size-3" />
            {shop.address ?? `${shop.district}, ${shop.city}`}
          </div>
        </div>
      </section>

      {/* Tabs */}
      <section className="sticky top-14 z-30 mt-6 border-y border-hairline bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-2">
          {(["photos", "about", "services", "team", "reviews"] as Tab[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={cn(
                "relative whitespace-nowrap px-4 py-3.5 text-sm transition-colors",
                tab === k ? "text-gold" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`shop.${k}`)}
              {tab === k && <span className="absolute inset-x-3 bottom-0 h-px bg-gold" />}
            </button>
          ))}
        </div>
      </section>

      <main className="mx-auto max-w-3xl px-4 pt-8 sm:px-6">
        {tab === "photos" && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {gallery.map((url, i) => (
              <div
                key={i}
                className="aspect-square overflow-hidden rounded-md bg-surface"
              >
                <img src={url} alt="" className="size-full object-cover" />
              </div>
            ))}
          </div>
        )}

        {tab === "about" && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-lg text-foreground">{t("shop.about")}</h2>
              <p
                className={cn(
                  "mt-3 text-sm leading-relaxed text-muted-foreground",
                  !expanded && "line-clamp-5",
                )}
              >
                {description || t("common.empty")}
              </p>
              {description.length > 200 && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="mt-2 text-xs font-medium text-gold hover:underline"
                >
                  {expanded ? t("shop.readLess") : t("shop.readMore")}
                </button>
              )}
            </div>

            {/* Hours */}
            <div>
              <h2 className="font-display text-lg text-foreground">{t("shop.hours")}</h2>
              <ul className="mt-3 divide-y divide-hairline overflow-hidden rounded-2xl border border-hairline bg-surface/60">
                {Array.from({ length: 7 }).map((_, i) => {
                  const h = shop.shop_hours.find((x) => x.day_of_week === i);
                  const isToday = new Date().getDay() === i;
                  const days = t("days.long", { returnObjects: true }) as string[];
                  return (
                    <li
                      key={i}
                      className={cn(
                        "flex items-center justify-between px-4 py-2.5 text-sm",
                        isToday ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      <span>{days[i]}</span>
                      <span dir="ltr" className={isToday ? "font-semibold text-gold" : ""}>
                        {h ? `${h.opens_at.slice(0, 5)} – ${h.closes_at.slice(0, 5)}` : "—"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Location */}
            {shop.lat && shop.lng && (
              <div>
                <h2 className="font-display text-lg text-foreground">{t("shop.location")}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {shop.address ?? `${shop.district}, ${shop.city}`}
                </p>
                <MapPreview lat={Number(shop.lat)} lng={Number(shop.lng)} label={name} className="mt-3" />
              </div>
            )}

            {shop.phone && (
              <a
                href={`tel:${shop.phone}`}
                className="inline-flex items-center gap-2 rounded-full border border-hairline px-4 py-2 text-sm text-foreground transition-colors hover:border-gold/50"
              >
                <Phone className="size-3.5" />
                {shop.phone}
              </a>
            )}
          </div>
        )}

        {tab === "services" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {shop.services.length} {t("shop.servicesAvailable")}
            </p>
            {shop.services.map((s) => (
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
                    {t("service.sar")} {formatPrice(Number(s.price_sar), lng)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => startBooking(s.id)}
                  className="shrink-0 rounded-full border border-gold/50 px-4 py-2 text-xs font-medium text-gold transition-colors hover:bg-gold hover:text-primary-foreground"
                >
                  {t("service.book")}
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === "team" && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {shop.barbers.map((b) => (
              <Link
                key={b.id}
                to="/barbers/$barberId"
                params={{ barberId: b.id }}
                className="group block overflow-hidden rounded-2xl border border-hairline bg-surface transition-all hover:border-gold/40"
              >
                <div className="relative">
                  <div
                    className="aspect-square bg-cover bg-center"
                    style={{ backgroundImage: `url(${b.photo_url})` }}
                  />
                  <span className="absolute bottom-2 start-2 inline-flex items-center gap-1 rounded-full bg-background/85 px-2 py-0.5 text-[10px] text-gold backdrop-blur">
                    <Star className="size-3" fill="currentColor" />
                    {Number(b.rating_avg).toFixed(1)}
                  </span>
                </div>
                <div className="p-3 text-center">
                  <p className="line-clamp-1 text-sm font-medium text-foreground">
                    {tt(b.display_name_en, b.display_name_ar)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {tt(b.title_en, b.title_ar)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {tab === "reviews" && <ReviewsList reviews={reviews} />}
      </main>

      {/* Sticky bottom CTA */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div>
            {minPrice !== null && (
              <>
                <p className="text-xs text-muted-foreground">{t("service.from")}</p>
                <p className="text-sm font-semibold text-foreground">
                  {t("service.sar")} {formatPrice(minPrice, lng)}
                </p>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => startBooking()}
            className="inline-flex flex-1 items-center justify-center rounded-full bg-gold px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-gold-glow"
          >
            {t("shop.bookNow")}
          </button>
        </div>
      </div>
    </div>
  );
}
