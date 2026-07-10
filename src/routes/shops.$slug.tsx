import { createFileRoute, notFound, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, Share2 } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { FavoriteButton } from "@/components/favorite-button";
import { ShopPublicView } from "@/components/shop/shop-public-view";
import { useLocale } from "@/lib/locale-provider";
import { fetchShopBySlug, fetchShopReviews } from "@/lib/queries";

export const Route = createFileRoute("/shops/$slug")({
  head: () => ({
    meta: [
      { title: `Shop — Qassah` },
      { name: "description", content: `Shop profile and booking on Qassah.` },
      { property: "og:title", content: `Shop — Qassah` },
      { property: "og:description", content: `Browse this shop's services, team, and reviews.` },
    ],
  }),
  component: ShopProfilePage,
});

function ShopProfilePage() {
  const { slug } = Route.useParams();
  const { t } = useTranslation();
  const { rtl } = useLocale();
  const router = useRouter();
  const navigate = useNavigate();
  const ArrowBack = rtl ? ArrowRight : ArrowLeft;

  const { data: shop, isLoading } = useQuery({
    queryKey: ["shop", slug],
    queryFn: () => fetchShopBySlug(slug),
  });
  const { data: reviews = [] } = useQuery({
    queryKey: ["shop-reviews", shop?.id],
    queryFn: () => fetchShopReviews(shop!.id),
    enabled: !!shop?.id,
  });

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

  function startBooking(serviceId?: string) {
    if (serviceId) {
      const onlyBarber = shop && shop.barbers.length === 1 ? shop.barbers[0] : null;
      navigate({
        to: "/book/shop/$shopSlug",
        params: { shopSlug: slug },
        search: (onlyBarber
          ? { service: serviceId, barber: onlyBarber.id, step: "date" }
          : { service: serviceId, step: "barber" }) as never,
      });
      return;
    }
    navigate({ to: "/book/shop/$shopSlug", params: { shopSlug: slug } });
  }

  const gallery = shop.shop_photos.length > 0
    ? shop.shop_photos.map((p) => p.url)
    : shop.cover_url ? [shop.cover_url] : [];

  const topBar = (
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
  );

  return (
    <ShopPublicView
      shop={shop as never}
      hours={shop.shop_hours as never}
      photos={shop.shop_photos as never}
      services={shop.services as never}
      barbers={shop.barbers as never}
      reviews={reviews as never}
      onBookNow={() => startBooking()}
      onBookService={(sid) => startBooking(sid)}
      topBar={topBar}
    />
  );
}
