import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMemo, useState, type ReactNode } from "react";
import {
  Clock, MapPin, Phone, Star, Pencil, Upload, Trash2, Plus, X, Eye, EyeOff,
  ChevronUp, ChevronDown, Image as ImageIcon,
} from "lucide-react";
import { StarRating } from "@/components/star-rating";
import { MapPreview } from "@/components/map-preview";
import { ReviewsList, type DemoReview } from "@/components/reviews-list";
import { useLocale } from "@/lib/locale-provider";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Shared data shape (both customer + owner routes normalize into this) */
/* ------------------------------------------------------------------ */

export type PublicShop = {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string;
  description_en: string | null;
  description_ar: string | null;
  cover_url: string | null;
  logo_url?: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  rating_avg: number;
  rating_count: number;
};

export type PublicHour = { day_of_week: number; opens_at: string; closes_at: string };
export type PublicPhoto = { id: string; url: string; sort: number; pending?: boolean };
export type PublicService = {
  id: string;
  name_en: string;
  name_ar: string;
  price_sar: number;
  duration_min: number;
};
export type PublicBarber = {
  id: string;
  display_name_en: string;
  display_name_ar: string;
  title_en?: string | null;
  title_ar?: string | null;
  photo_url: string | null;
  rating_avg: number;
};

export type PublicReview = DemoReview & { hidden?: boolean };

export type EditHandlers = {
  onEditCover?: () => void;
  onRemoveCover?: () => void;
  onEditLogo?: () => void;
  onEditName?: () => void;
  onEditAddress?: () => void;
  onEditDescription?: () => void;
  onEditHours?: () => void;
  onEditLocation?: () => void;
  onEditPhone?: () => void;
  onAddPhoto?: () => void;
  onReplacePhoto?: (id: string) => void;
  onDeletePhoto?: (id: string) => void;
  onMovePhoto?: (id: string, dir: -1 | 1) => void;
  onAddService?: () => void;
  onEditService?: (id: string) => void;
  onDeleteService?: (id: string) => void;
  onAddBarber?: () => void;
  onEditBarber?: (id: string) => void;
  onDeleteBarber?: (id: string) => void;
  onToggleReviewHidden?: (id: string, hidden: boolean) => void;
};

type Tab = "photos" | "about" | "services" | "team" | "reviews";

const SAMPLE_COVER =
  "https://images.unsplash.com/photo-1521490878406-df4b2237c5f6?auto=format&fit=crop&w=1600&q=80";
const SAMPLE_GALLERY = [
  "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=800&q=80",
];
const SAMPLE_TEAM = [
  { id: "s1", display_name_en: "Ahmad Ali", display_name_ar: "أحمد علي", title_en: "Senior barber", title_ar: "حلاق أول", photo_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80", rating_avg: 4.8 },
  { id: "s2", display_name_en: "Omar Khaled", display_name_ar: "عمر خالد", title_en: "Barber", title_ar: "حلاق", photo_url: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80", rating_avg: 4.6 },
];
const SAMPLE_SERVICES: PublicService[] = [
  { id: "s1", name_en: "Classic haircut", name_ar: "قصة كلاسيك", price_sar: 90, duration_min: 45 },
  { id: "s2", name_en: "Beard trim", name_ar: "تنسيق لحية", price_sar: 50, duration_min: 30 },
  { id: "s3", name_en: "Skin fade", name_ar: "سكن فيد", price_sar: 85, duration_min: 40 },
];
const SAMPLE_DESC_EN = "An upscale men's salon offering premium haircuts, beard styling, and grooming.";
const SAMPLE_DESC_AR = "صالون رجالي راقٍ يقدم قصات شعر مميزة وتنسيق لحية وعناية شاملة.";

/* ------------------------------------------------------------------ */
/* Overlay helpers                                                     */
/* ------------------------------------------------------------------ */

function EditChip({ onClick, children, className }: { onClick?: () => void; children: ReactNode; className?: string }) {
  if (!onClick) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-gold/60 bg-background/85 px-2.5 py-1 text-[11px] font-medium text-gold backdrop-blur transition hover:bg-gold hover:text-primary-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

function PlaceholderTag() {
  const { t } = useTranslation();
  return (
    <span className="pointer-events-none absolute start-2 top-2 z-10 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white/90">
      {t("owner.publicPage.sample", "Sample")}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Main view                                                           */
/* ------------------------------------------------------------------ */

export function ShopPublicView({
  shop,
  hours,
  photos,
  services,
  barbers,
  reviews,
  editMode = false,
  edit,
  onBookNow,
  onBookService,
  showBookingBar = true,
  topBar,
}: {
  shop: PublicShop;
  hours: PublicHour[];
  photos: PublicPhoto[];
  services: PublicService[];
  barbers: PublicBarber[];
  reviews: PublicReview[];
  editMode?: boolean;
  edit?: EditHandlers;
  onBookNow?: () => void;
  onBookService?: (serviceId: string) => void;
  showBookingBar?: boolean;
  topBar?: ReactNode;
}) {
  const { t } = useTranslation();
  const { t: tt, lng } = useLocale();
  const [tab, setTab] = useState<Tab>("photos");
  const [expanded, setExpanded] = useState(false);

  // Apply sample fallbacks in edit mode so the page always looks completed.
  const effectiveCover = shop.cover_url || (editMode ? SAMPLE_COVER : null);
  const effectivePhotos = photos.length > 0
    ? photos
    : editMode
      ? SAMPLE_GALLERY.map((url, i) => ({ id: `sample-${i}`, url, sort: i }))
      : [];
  const effectiveServices = services.length > 0 ? services : editMode ? SAMPLE_SERVICES : [];
  const effectiveBarbers = barbers.length > 0 ? barbers : editMode ? (SAMPLE_TEAM as PublicBarber[]) : [];
  const rawDesc = tt(shop.description_en ?? "", shop.description_ar ?? "");
  const description = rawDesc || (editMode ? tt(SAMPLE_DESC_EN, SAMPLE_DESC_AR) : "");
  const isSampleGallery = photos.length === 0 && editMode;
  const isSampleServices = services.length === 0 && editMode;
  const isSampleTeam = barbers.length === 0 && editMode;
  const isSampleDesc = !rawDesc && editMode;

  const gallery = effectivePhotos.length > 0
    ? effectivePhotos.map((p) => p.url)
    : effectiveCover
      ? [effectiveCover]
      : [];

  const name = tt(shop.name_en, shop.name_ar);

  const todayHours = useMemo(() => {
    const today = new Date().getDay();
    return hours.find((h) => h.day_of_week === today) ?? null;
  }, [hours]);

  const minPrice = effectiveServices.length > 0
    ? Math.min(...effectiveServices.map((s) => Number(s.price_sar)))
    : null;

  return (
    <div className="min-h-screen bg-background pb-28">
      {topBar}

      {/* Cover */}
      <section className="relative group">
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
        {editMode && (
          <div className="absolute inset-x-0 top-4 flex justify-center gap-2 opacity-0 transition group-hover:opacity-100">
            <EditChip onClick={edit?.onEditCover}>
              <Upload className="size-3" /> {t("owner.publicPage.changeCover", "Change cover")}
            </EditChip>
            {shop.cover_url && (
              <EditChip onClick={edit?.onRemoveCover}>
                <Trash2 className="size-3" /> {t("owner.publicPage.removeCover", "Remove")}
              </EditChip>
            )}
          </div>
        )}
      </section>

      {/* Header card */}
      <section className="mx-auto -mt-16 max-w-3xl px-4 sm:px-6">
        <div className="group relative rounded-3xl border border-hairline bg-surface/95 p-6 backdrop-blur sm:p-8">
          <div className="flex items-start gap-4">
            {(shop.logo_url || editMode) && (
              <div className="relative">
                <div className="size-14 shrink-0 overflow-hidden rounded-2xl border border-hairline bg-background">
                  {shop.logo_url ? (
                    <img src={shop.logo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-muted-foreground">
                      <ImageIcon className="size-6" />
                    </div>
                  )}
                </div>
                {editMode && (
                  <button
                    type="button"
                    onClick={edit?.onEditLogo}
                    className="absolute -end-1 -bottom-1 grid size-6 place-items-center rounded-full border border-gold/60 bg-background text-gold opacity-0 transition group-hover:opacity-100"
                    aria-label="Edit logo"
                  >
                    <Pencil className="size-3" />
                  </button>
                )}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="font-display text-3xl tracking-tight text-foreground sm:text-4xl">
                  {name}
                </h1>
                {editMode && (
                  <EditChip
                    onClick={edit?.onEditName}
                    className="opacity-0 transition group-hover:opacity-100"
                  >
                    <Pencil className="size-3" />
                  </EditChip>
                )}
              </div>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {t("barber.title")}
              </p>
            </div>
          </div>
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
            {shop.address || `${shop.district ?? ""}${shop.district && shop.city ? ", " : ""}${shop.city ?? ""}` || (editMode ? t("owner.publicPage.addAddress", "Add address") : "")}
            {editMode && (
              <EditChip onClick={edit?.onEditAddress} className="ms-2">
                <Pencil className="size-3" />
              </EditChip>
            )}
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
          <div>
            {editMode && (
              <div className="mb-3 flex justify-end">
                <EditChip onClick={edit?.onAddPhoto}>
                  <Plus className="size-3" /> {t("owner.publicPage.addPhoto", "Add photo")}
                </EditChip>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {gallery.map((url, i) => {
                const photo = effectivePhotos[i];
                const isSample = isSampleGallery;
                return (
                  <div
                    key={photo?.id ?? i}
                    className="group relative aspect-square overflow-hidden rounded-md bg-surface"
                  >
                    <img src={url} alt="" className="size-full object-cover" />
                    {editMode && isSample && <PlaceholderTag />}
                    {editMode && !isSample && photo && (
                      <div className="absolute inset-0 flex flex-col justify-between bg-black/40 p-2 opacity-0 transition group-hover:opacity-100">
                        <div className="flex justify-between">
                          <div className="flex gap-1">
                            <EditChip onClick={() => edit?.onMovePhoto?.(photo.id, -1)}>
                              <ChevronUp className="size-3" />
                            </EditChip>
                            <EditChip onClick={() => edit?.onMovePhoto?.(photo.id, 1)}>
                              <ChevronDown className="size-3" />
                            </EditChip>
                          </div>
                          <EditChip onClick={() => edit?.onDeletePhoto?.(photo.id)}>
                            <Trash2 className="size-3" />
                          </EditChip>
                        </div>
                        <EditChip onClick={() => edit?.onReplacePhoto?.(photo.id)} className="self-start">
                          <Upload className="size-3" /> {t("owner.publicPage.replace", "Replace")}
                        </EditChip>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "about" && (
          <div className="space-y-6">
            <div className="group relative">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg text-foreground">{t("shop.about")}</h2>
                {editMode && (
                  <EditChip onClick={edit?.onEditDescription} className="opacity-0 transition group-hover:opacity-100">
                    <Pencil className="size-3" />
                  </EditChip>
                )}
                {isSampleDesc && (
                  <span className="rounded-full bg-black/70 px-2 py-0.5 text-[10px] text-white/90">
                    {t("owner.publicPage.sample", "Sample")}
                  </span>
                )}
              </div>
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

            <div className="group relative">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg text-foreground">{t("shop.hours")}</h2>
                {editMode && (
                  <EditChip onClick={edit?.onEditHours} className="opacity-0 transition group-hover:opacity-100">
                    <Pencil className="size-3" />
                  </EditChip>
                )}
              </div>
              <ul className="mt-3 divide-y divide-hairline overflow-hidden rounded-2xl border border-hairline bg-surface/60">
                {Array.from({ length: 7 }).map((_, i) => {
                  const h = hours.find((x) => x.day_of_week === i);
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

            {(shop.lat && shop.lng) || editMode ? (
              <div className="group relative">
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-lg text-foreground">{t("shop.location")}</h2>
                  {editMode && (
                    <EditChip onClick={edit?.onEditLocation} className="opacity-0 transition group-hover:opacity-100">
                      <Pencil className="size-3" /> {t("owner.publicPage.changeLocation", "Change location")}
                    </EditChip>
                  )}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {shop.address ?? `${shop.district ?? ""}, ${shop.city ?? ""}`}
                </p>
                {shop.lat && shop.lng ? (
                  <MapPreview lat={Number(shop.lat)} lng={Number(shop.lng)} label={name} className="mt-3" />
                ) : (
                  <div className="mt-3 rounded-2xl border border-dashed border-hairline p-6 text-center text-xs text-muted-foreground">
                    {t("owner.publicPage.noLocation", "No map location set")}
                  </div>
                )}
              </div>
            ) : null}

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
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {effectiveServices.length} {t("shop.servicesAvailable")}
                {isSampleServices && (
                  <span className="ms-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] text-white/90">
                    {t("owner.publicPage.sample", "Sample")}
                  </span>
                )}
              </p>
              {editMode && (
                <EditChip onClick={edit?.onAddService}>
                  <Plus className="size-3" /> {t("owner.publicPage.addService", "Add service")}
                </EditChip>
              )}
            </div>
            {effectiveServices.map((s) => (
              <div
                key={s.id}
                className="group relative flex items-center justify-between gap-4 rounded-2xl border border-hairline bg-surface p-4"
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
                {editMode && !isSampleServices ? (
                  <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
                    <EditChip onClick={() => edit?.onEditService?.(s.id)}>
                      <Pencil className="size-3" />
                    </EditChip>
                    <EditChip onClick={() => edit?.onDeleteService?.(s.id)}>
                      <Trash2 className="size-3" />
                    </EditChip>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onBookService?.(s.id)}
                    disabled={editMode}
                    className="shrink-0 rounded-full border border-gold/50 px-4 py-2 text-xs font-medium text-gold transition-colors hover:bg-gold hover:text-primary-foreground disabled:opacity-50"
                  >
                    {t("service.book")}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === "team" && (
          <div>
            {editMode && (
              <div className="mb-3 flex justify-end">
                <EditChip onClick={edit?.onAddBarber}>
                  <Plus className="size-3" /> {t("owner.publicPage.addBarber", "Add barber")}
                </EditChip>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {effectiveBarbers.map((b) => {
                const inner = (
                  <div className="group block overflow-hidden rounded-2xl border border-hairline bg-surface transition-all hover:border-gold/40">
                    <div className="relative">
                      <div
                        className="aspect-square bg-cover bg-center"
                        style={{ backgroundImage: `url(${b.photo_url ?? ""})` }}
                      />
                      <span className="absolute bottom-2 start-2 inline-flex items-center gap-1 rounded-full bg-background/85 px-2 py-0.5 text-[10px] text-gold backdrop-blur">
                        <Star className="size-3" fill="currentColor" />
                        {Number(b.rating_avg ?? 0).toFixed(1)}
                      </span>
                      {isSampleTeam && <PlaceholderTag />}
                      {editMode && !isSampleTeam && (
                        <div className="absolute inset-x-2 top-2 flex justify-end gap-1 opacity-0 transition group-hover:opacity-100">
                          <EditChip onClick={() => edit?.onEditBarber?.(b.id)}>
                            <Pencil className="size-3" />
                          </EditChip>
                          <EditChip onClick={() => edit?.onDeleteBarber?.(b.id)}>
                            <Trash2 className="size-3" />
                          </EditChip>
                        </div>
                      )}
                    </div>
                    <div className="p-3 text-center">
                      <p className="line-clamp-1 text-sm font-medium text-foreground">
                        {tt(b.display_name_en, b.display_name_ar)}
                      </p>
                      {(b.title_en || b.title_ar) && (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {tt(b.title_en ?? "", b.title_ar ?? "")}
                        </p>
                      )}
                    </div>
                  </div>
                );
                if (editMode) return <div key={b.id}>{inner}</div>;
                return (
                  <Link key={b.id} to="/barbers/$barberId" params={{ barberId: b.id }}>
                    {inner}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {tab === "reviews" && (
          <div>
            {editMode ? (
              <OwnerReviewList reviews={reviews} edit={edit} />
            ) : (
              <ReviewsList reviews={reviews} />
            )}
          </div>
        )}
      </main>

      {showBookingBar && (
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
              onClick={() => (editMode ? null : onBookNow?.())}
              disabled={editMode}
              className="inline-flex flex-1 items-center justify-center rounded-full bg-gold px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-gold-glow disabled:opacity-70"
            >
              {t("shop.bookNow")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function OwnerReviewList({ reviews, edit }: { reviews: PublicReview[]; edit?: EditHandlers }) {
  const { t } = useTranslation();
  if (!reviews.length) {
    return (
      <p className="rounded-2xl border border-hairline bg-surface/40 p-8 text-center text-sm text-muted-foreground">
        {t("shop.noReviews")}
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {reviews.map((r) => (
        <li key={r.id} className={cn("group relative rounded-2xl border border-hairline bg-surface/60 p-5", r.hidden && "opacity-60")}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">{r.reviewer_name}</p>
              <p className="text-[11px] text-muted-foreground">
                {new Date(r.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5 text-gold">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="size-3.5" fill={i < r.rating ? "currentColor" : "none"} />
                ))}
              </div>
              <EditChip onClick={() => edit?.onToggleReviewHidden?.(r.id, !r.hidden)}>
                {r.hidden ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
              </EditChip>
            </div>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{r.comment}</p>
        </li>
      ))}
    </ul>
  );
}

/* Named unused import cleanup */
export const _unused = { X };
