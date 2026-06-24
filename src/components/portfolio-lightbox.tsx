import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { X, ChevronLeft, ChevronRight, MapPin, Scissors } from "lucide-react";
import { useEffect } from "react";
import { useLocale } from "@/lib/locale-provider";
import { formatPrice } from "@/lib/format";
import { FavoriteButton } from "@/components/favorite-button";
import type { PortfolioCard } from "@/lib/queries";

export function PortfolioLightbox({
  items,
  index,
  onChange,
  onClose,
}: {
  items: PortfolioCard[];
  index: number;
  onChange: (i: number) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { t: tt, lng, rtl } = useLocale();
  const photo = items[index];
  const prev = () => onChange((index - 1 + items.length) % items.length);
  const next = () => onChange((index + 1) % items.length);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") (rtl ? prev : next)();
      if (e.key === "ArrowLeft") (rtl ? next : prev)();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, items.length, rtl]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!photo) return null;

  const barberName = tt(
    photo.barber.display_name_en,
    photo.barber.display_name_ar,
  );
  const shopName = tt(photo.barber.shop.name_en, photo.barber.shop.name_ar);
  const styleName =
    photo.portfolio_photo_specialties[0]?.specialty &&
    tt(
      photo.portfolio_photo_specialties[0].specialty.label_en,
      photo.portfolio_photo_specialties[0].specialty.label_ar,
    );
  const caption = tt(photo.caption_en ?? "", photo.caption_ar ?? "");
  const minPrice =
    photo.barber.barber_services.length > 0
      ? Math.min(
          ...photo.barber.barber_services.map((bs) => Number(bs.service.price_sar)),
        )
      : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/96 backdrop-blur-md">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-4">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {index + 1} / {items.length}
        </p>
        <div className="flex items-center gap-2">
          <FavoriteButton
            type="style"
            id={photo.id}
            snapshot={{
              title_en: photo.caption_en || styleName || barberName,
              title_ar: photo.caption_ar || styleName || barberName,
              subtitle_en: photo.barber.display_name_en,
              subtitle_ar: photo.barber.display_name_ar,
              image_url: photo.url,
            }}
          />
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-10 items-center justify-center rounded-full border border-hairline text-foreground hover:border-gold/50"
            aria-label={t("common.close")}
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Main split */}
      <div className="flex flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
        {/* Photo */}
        <div className="relative flex flex-1 items-center justify-center px-4 py-4 md:py-0">
          <button
            type="button"
            onClick={prev}
            className="absolute start-4 z-10 inline-flex size-10 items-center justify-center rounded-full border border-hairline bg-background/40 text-foreground hover:border-gold/50"
            aria-label="prev"
          >
            {rtl ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          </button>
          <img
            src={photo.url}
            alt={caption || styleName || barberName}
            className="max-h-[78vh] max-w-full rounded-2xl object-contain shadow-2xl"
          />
          <button
            type="button"
            onClick={next}
            className="absolute end-4 z-10 inline-flex size-10 items-center justify-center rounded-full border border-hairline bg-background/40 text-foreground hover:border-gold/50"
            aria-label="next"
          >
            {rtl ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
        </div>

        {/* Sidebar */}
        <aside className="w-full shrink-0 border-t border-hairline bg-surface/40 p-6 md:w-[360px] md:border-s md:border-t-0">
          {styleName && (
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">
              {styleName}
            </p>
          )}
          {caption && (
            <h2 className="mt-2 font-display text-2xl leading-tight text-foreground">
              {caption}
            </h2>
          )}

          <Link
            to="/barbers/$barberId"
            params={{ barberId: photo.barber.id }}
            onClick={onClose}
            className="mt-5 flex items-center gap-3 rounded-2xl border border-hairline bg-background/50 p-3 transition-colors hover:border-gold/40"
          >
            <img
              src={photo.barber.photo_url ?? ""}
              alt={barberName}
              className="size-12 rounded-full object-cover ring-1 ring-gold/40"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {barberName}
              </p>
              <p className="mt-0.5 inline-flex items-center gap-1 truncate text-xs text-muted-foreground">
                <Scissors className="size-3" />
                {shopName}
              </p>
            </div>
          </Link>

          <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="size-3" />
            {photo.barber.shop.district}, {photo.barber.shop.city}
          </div>

          {minPrice !== null && (
            <div className="mt-5 rounded-2xl border border-hairline bg-background/50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {t("service.from")}
              </p>
              <p className="mt-1 font-display text-2xl text-gold">
                {t("service.sar")} {formatPrice(minPrice, lng)}
              </p>
            </div>
          )}

          <Link
            to="/book/$barberId"
            params={{ barberId: photo.barber.id }}
            search={
              {
                photo: photo.id,
                step: "date",
                ...(photo.service_id ? { service: photo.service_id } : {}),
              } as never
            }
            onClick={onClose}
            className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-gold px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-gold-glow"
          >
            {t("barber.bookThisLook")}
          </Link>
        </aside>
      </div>
    </div>
  );
}
