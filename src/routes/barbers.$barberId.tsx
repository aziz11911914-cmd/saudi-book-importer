import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  Share2,
  Clock,
  Pencil,
  X,
  Check,
  ImagePlus,
  Trash2,
  Plus,
  RefreshCw,
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
import { supabase } from "@/integrations/supabase/client";
import { useBarberPermissions, type BarberRole } from "@/lib/use-barber-permissions";
import {
  createBarberUploadUrl,
  updateBarberBio,
  setBarberImage,
  toggleBarberService,
  updateBarberServiceDetails,
  addPortfolioPhoto,
  replacePortfolioPhoto,
  deletePortfolioPhoto,
} from "@/lib/barber-profile.functions";

export const Route = createFileRoute("/barbers/$barberId")({
  head: () => ({
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
  const qc = useQueryClient();
  const { canEdit, role } = useBarberPermissions(barberId);
  const canEditServiceDetails = role === "owner" || role === "admin";

  const [tab, setTab] = useState<Tab>("about");
  const [filterSlug, setFilterSlug] = useState<string>("all");
  const [lightbox, setLightbox] = useState<number | null>(null);

  const barberKey = ["barber", barberId] as const;
  const { data: barber, isLoading } = useQuery({
    queryKey: barberKey,
    queryFn: () => fetchBarberFull(barberId),
  });
  const { data: reviews = [] } = useQuery({
    queryKey: ["barber-reviews", barberId],
    queryFn: () => fetchBarberReviews(barberId),
  });

  // All shop services (for enable/disable when editing)
  const { data: shopServices = [] } = useQuery({
    enabled: canEdit && !!barber?.shop.id,
    queryKey: ["shop-services", barber?.shop.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("services")
        .select("id, name_en, name_ar, price_sar, duration_min")
        .eq("shop_id", barber!.shop.id);
      return data ?? [];
    },
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

  // ---- Mutations (optimistic where possible) ----
  const setImageFn = useServerFn(setBarberImage);
  const uploadFn = useServerFn(createBarberUploadUrl);
  const bioFn = useServerFn(updateBarberBio);
  const toggleSvcFn = useServerFn(toggleBarberService);
  const updateSvcFn = useServerFn(updateBarberServiceDetails);
  const addPhotoFn = useServerFn(addPortfolioPhoto);
  const replacePhotoFn = useServerFn(replacePortfolioPhoto);
  const deletePhotoFn = useServerFn(deletePortfolioPhoto);

  async function uploadFile(file: File, kind: "photo" | "cover" | "portfolio"): Promise<string> {
    const safe = file.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120) || "upload";
    const signed = await uploadFn({ data: { barberId, filename: safe, kind } });
    const res = await fetch(signed.signedUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    return signed.publicUrl;
  }

  function optimisticPatch(patch: (b: any) => any) {
    qc.setQueryData(barberKey, (prev: any) => (prev ? patch({ ...prev }) : prev));
  }

  const imageMutation = useMutation({
    mutationFn: async (vars: { field: "photo_url" | "cover_url"; url: string | null }) =>
      setImageFn({ data: { barberId, field: vars.field, url: vars.url } }),
    onMutate: (vars) => {
      const prev = qc.getQueryData(barberKey);
      optimisticPatch((b) => ({ ...b, [vars.field]: vars.url }));
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(barberKey, ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: barberKey }),
  });

  const bioMutation = useMutation({
    mutationFn: async (vars: { bio_en?: string; bio_ar?: string }) =>
      bioFn({ data: { barberId, ...vars } }),
    onMutate: (vars) => {
      const prev = qc.getQueryData(barberKey);
      optimisticPatch((b) => ({ ...b, ...vars }));
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(barberKey, ctx.prev),
  });

  const toggleServiceMutation = useMutation({
    mutationFn: async (vars: { serviceId: string; enabled: boolean }) =>
      toggleSvcFn({ data: { barberId, ...vars } }),
    onSettled: () => qc.invalidateQueries({ queryKey: barberKey }),
  });

  const updateServiceMutation = useMutation({
    mutationFn: async (vars: { serviceId: string; price_sar?: number; duration_min?: number }) =>
      updateSvcFn({ data: { barberId, ...vars } }),
    onMutate: (vars) => {
      const prev = qc.getQueryData(barberKey);
      optimisticPatch((b) => ({
        ...b,
        barber_services: b.barber_services.map((bs: any) =>
          bs.service.id === vars.serviceId
            ? {
                ...bs,
                service: {
                  ...bs.service,
                  ...(vars.price_sar !== undefined ? { price_sar: vars.price_sar } : {}),
                  ...(vars.duration_min !== undefined
                    ? { duration_min: vars.duration_min }
                    : {}),
                },
              }
            : bs,
        ),
      }));
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(barberKey, ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: barberKey }),
  });

  const addPhotoMutation = useMutation({
    mutationFn: async (vars: { url: string }) =>
      addPhotoFn({ data: { barberId, url: vars.url } }),
    onSettled: () => qc.invalidateQueries({ queryKey: barberKey }),
  });

  const replacePhotoMutation = useMutation({
    mutationFn: async (vars: { photoId: string; url: string }) =>
      replacePhotoFn({ data: { barberId, ...vars } }),
    onMutate: (vars) => {
      const prev = qc.getQueryData(barberKey);
      optimisticPatch((b) => ({
        ...b,
        portfolio_photos: b.portfolio_photos.map((p: any) =>
          p.id === vars.photoId ? { ...p, url: vars.url } : p,
        ),
      }));
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(barberKey, ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: barberKey }),
  });

  const deletePhotoMutation = useMutation({
    mutationFn: async (vars: { photoId: string }) =>
      deletePhotoFn({ data: { barberId, ...vars } }),
    onMutate: (vars) => {
      const prev = qc.getQueryData(barberKey);
      optimisticPatch((b) => ({
        ...b,
        portfolio_photos: b.portfolio_photos.filter((p: any) => p.id !== vars.photoId),
      }));
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(barberKey, ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: barberKey }),
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
  const coverUrl = (barber as any).cover_url as string | null | undefined;

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
            {canEdit && (
              <EditRoleBadge role={role} />
            )}
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

      {/* Cover image */}
      {(coverUrl || canEdit) && (
        <CoverBanner
          url={coverUrl ?? null}
          canEdit={canEdit}
          onUpload={async (file) => {
            const url = await uploadFile(file, "cover");
            imageMutation.mutate({ field: "cover_url", url });
          }}
          onRemove={() => imageMutation.mutate({ field: "cover_url", url: null })}
        />
      )}

      {/* Identity */}
      <section className="relative mx-auto max-w-3xl px-4 pt-10">
        <div className="flex flex-col items-center text-center">
          <ProfilePhoto
            url={barber.photo_url ?? ""}
            name={name}
            canEdit={canEdit}
            onUpload={async (file) => {
              const url = await uploadFile(file, "photo");
              imageMutation.mutate({ field: "photo_url", url });
            }}
            onRemove={() => imageMutation.mutate({ field: "photo_url", url: null })}
          />
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
          <BioBlock
            bioEn={barber.bio_en ?? ""}
            bioAr={barber.bio_ar ?? ""}
            display={bio}
            canEdit={canEdit}
            lng={lng}
            onSave={(vars) => bioMutation.mutate(vars)}
          />
        )}

        {tab === "services" && (
          <ServicesBlock
            barberServices={barber.barber_services}
            shopServices={shopServices as any[]}
            canEdit={canEdit}
            canEditDetails={canEditServiceDetails}
            lng={lng}
            onToggle={(serviceId, enabled) =>
              toggleServiceMutation.mutate({ serviceId, enabled })
            }
            onEditDetails={(vars) => updateServiceMutation.mutate(vars)}
            onBook={(id) =>
              navigate({
                to: "/book/$barberId",
                params: { barberId: barber.id },
                search: { service: id, step: "date" } as never,
              })
            }
          />
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
                <PortfolioTile
                  key={p.id}
                  photo={p}
                  onOpen={() => setLightbox(i)}
                  canEdit={canEdit}
                  onReplace={async (file) => {
                    const url = await uploadFile(file, "portfolio");
                    replacePhotoMutation.mutate({ photoId: p.id, url });
                  }}
                  onDelete={() => deletePhotoMutation.mutate({ photoId: p.id })}
                />
              ))}
              {canEdit && (
                <PortfolioAdd
                  onUpload={async (file) => {
                    const url = await uploadFile(file, "portfolio");
                    addPhotoMutation.mutate({ url });
                  }}
                />
              )}
              {photos.length === 0 && !canEdit && (
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

      {/* Sticky book bar — hidden for editors so they don't book themselves */}
      {!canEdit && (
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
      )}
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

// ================= Inline edit UI =================

function EditRoleBadge({ role }: { role: BarberRole }) {
  const label = role === "self" ? "You" : role === "owner" ? "Owner" : "Admin";
  return (
    <span className="rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-gold">
      {label} · Edit
    </span>
  );
}

function IconBtn({
  onClick,
  label,
  children,
  className,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-full border border-gold/40 bg-background/80 text-gold shadow-md backdrop-blur transition-colors hover:bg-gold hover:text-primary-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

function CoverBanner({
  url,
  canEdit,
  onUpload,
  onRemove,
}: {
  url: string | null;
  canEdit: boolean;
  onUpload: (f: File) => Promise<void> | void;
  onRemove: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function pick(f: File | null) {
    if (!f) return;
    setBusy(true);
    try {
      await onUpload(f);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="relative">
      <div className="mx-auto h-40 max-w-3xl overflow-hidden sm:h-56">
        {url ? (
          <img src={url} alt="" className="size-full object-cover" />
        ) : (
          <div className="size-full bg-gradient-to-br from-surface to-background" />
        )}
      </div>
      {canEdit && (
        <div className="absolute inset-x-0 top-2 mx-auto flex max-w-3xl justify-end gap-2 px-3">
          <input
            ref={ref}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
          />
          <IconBtn
            onClick={() => ref.current?.click()}
            label="Change cover"
          >
            {busy ? <RefreshCw className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />}
          </IconBtn>
          {url && (
            <IconBtn onClick={onRemove} label="Remove cover">
              <Trash2 className="size-3.5" />
            </IconBtn>
          )}
        </div>
      )}
    </div>
  );
}

function ProfilePhoto({
  url,
  name,
  canEdit,
  onUpload,
  onRemove,
}: {
  url: string;
  name: string;
  canEdit: boolean;
  onUpload: (f: File) => Promise<void> | void;
  onRemove: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function pick(f: File | null) {
    if (!f) return;
    setBusy(true);
    try {
      await onUpload(f);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="relative">
      <div className="absolute inset-0 -m-1 rounded-full gradient-gold opacity-80 blur-[1px]" />
      {url ? (
        <img
          src={url}
          alt={name}
          className="relative size-32 rounded-full object-cover ring-1 ring-gold/60"
        />
      ) : (
        <div className="relative flex size-32 items-center justify-center rounded-full bg-surface text-3xl font-display text-muted-foreground ring-1 ring-gold/60">
          {name.slice(0, 1)}
        </div>
      )}
      {canEdit && (
        <>
          <input
            ref={ref}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
          />
          <div className="absolute -bottom-1 end-0 flex gap-1">
            <IconBtn onClick={() => ref.current?.click()} label="Change photo">
              {busy ? <RefreshCw className="size-3.5 animate-spin" /> : <Pencil className="size-3.5" />}
            </IconBtn>
            {url && (
              <IconBtn onClick={onRemove} label="Remove photo">
                <Trash2 className="size-3.5" />
              </IconBtn>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function BioBlock({
  bioEn,
  bioAr,
  display,
  canEdit,
  lng,
  onSave,
}: {
  bioEn: string;
  bioAr: string;
  display: string;
  canEdit: boolean;
  lng: string;
  onSave: (v: { bio_en?: string; bio_ar?: string }) => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(lng === "ar" ? bioAr : bioEn);

  function begin() {
    setValue(lng === "ar" ? bioAr : bioEn);
    setEditing(true);
  }
  function save() {
    onSave(lng === "ar" ? { bio_ar: value } : { bio_en: value });
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
        <div className="flex items-start justify-between gap-3">
          {display ? <p className="whitespace-pre-wrap">{display}</p> : <p>{t("common.empty")}</p>}
          {canEdit && (
            <IconBtn onClick={begin} label="Edit bio" className="shrink-0">
              <Pencil className="size-3.5" />
            </IconBtn>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={6}
        className="w-full rounded-2xl border border-hairline bg-surface p-4 text-sm text-foreground focus:border-gold/60 focus:outline-none"
        placeholder={t("common.writeBio") as string}
        autoFocus
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-4 py-2 text-xs text-muted-foreground hover:border-gold/40"
        >
          <X className="size-3.5" /> {t("common.cancel")}
        </button>
        <button
          type="button"
          onClick={save}
          className="inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-gold-glow"
        >
          <Check className="size-3.5" /> {t("common.save")}
        </button>
      </div>
    </div>
  );
}

function ServicesBlock({
  barberServices,
  shopServices,
  canEdit,
  canEditDetails,
  lng,
  onToggle,
  onEditDetails,
  onBook,
}: {
  barberServices: { service: any }[];
  shopServices: any[];
  canEdit: boolean;
  canEditDetails: boolean;
  lng: string;
  onToggle: (serviceId: string, enabled: boolean) => void;
  onEditDetails: (v: { serviceId: string; price_sar?: number; duration_min?: number }) => void;
  onBook: (id: string) => void;
}) {
  const { t } = useTranslation();
  const { t: tt } = useLocale();
  const enabledIds = new Set(barberServices.map((bs) => bs.service.id));
  const rows = canEdit ? shopServices : barberServices.map((bs) => bs.service);
  return (
    <div className="space-y-3">
      {rows.map((s: any) => {
        const enabled = enabledIds.has(s.id);
        return (
          <ServiceRow
            key={s.id}
            service={s}
            enabled={enabled}
            canEdit={canEdit}
            canEditDetails={canEditDetails}
            lng={lng}
            onToggle={(en) => onToggle(s.id, en)}
            onEditDetails={(v) => onEditDetails({ serviceId: s.id, ...v })}
            onBook={() => onBook(s.id)}
            label={tt(s.name_en, s.name_ar)}
          />
        );
      })}
      {rows.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">{t("common.empty")}</p>
      )}
    </div>
  );
}

function ServiceRow({
  service,
  enabled,
  canEdit,
  canEditDetails,
  lng,
  onToggle,
  onEditDetails,
  onBook,
  label,
}: {
  service: any;
  enabled: boolean;
  canEdit: boolean;
  canEditDetails: boolean;
  lng: string;
  onToggle: (en: boolean) => void;
  onEditDetails: (v: { price_sar?: number; duration_min?: number }) => void;
  onBook: () => void;
  label: string;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState(String(service.price_sar));
  const [dur, setDur] = useState(String(service.duration_min));

  function save() {
    const p = Number(price);
    const d = Number(dur);
    onEditDetails({
      ...(Number.isFinite(p) ? { price_sar: p } : {}),
      ...(Number.isFinite(d) ? { duration_min: d } : {}),
    });
    setEditing(false);
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-2xl border p-4 transition-opacity",
        enabled ? "border-hairline bg-surface" : "border-hairline/40 bg-surface/40 opacity-60",
      )}
    >
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-medium text-foreground">{label}</h3>
        {editing ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>{t("service.sar")}</span>
              <input
                type="number"
                value={price}
                min={0}
                onChange={(e) => setPrice(e.target.value)}
                className="w-20 rounded-lg border border-hairline bg-background px-2 py-1 text-sm text-foreground"
              />
            </label>
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="size-3" />
              <input
                type="number"
                value={dur}
                min={5}
                onChange={(e) => setDur(e.target.value)}
                className="w-16 rounded-lg border border-hairline bg-background px-2 py-1 text-sm text-foreground"
              />
              <span>{t("service.min")}</span>
            </label>
          </div>
        ) : (
          <>
            <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3" />
              {service.duration_min} {t("service.min")}
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {t("service.sar")} {formatPrice(service.price_sar, lng)}
            </p>
          </>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        {canEdit ? (
          <>
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => onToggle(e.target.checked)}
                className="accent-gold"
              />
              <span className="text-muted-foreground">
                {enabled ? t("common.enabled") : t("common.disabled")}
              </span>
            </label>
            {canEditDetails && (
              editing ? (
                <div className="flex gap-1">
                  <IconBtn onClick={save} label="Save"><Check className="size-3.5" /></IconBtn>
                  <IconBtn onClick={() => setEditing(false)} label="Cancel"><X className="size-3.5" /></IconBtn>
                </div>
              ) : (
                <IconBtn onClick={() => setEditing(true)} label="Edit service"><Pencil className="size-3.5" /></IconBtn>
              )
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={onBook}
            className="rounded-full border border-gold/50 px-4 py-2 text-xs font-medium text-gold transition-colors hover:bg-gold hover:text-primary-foreground"
          >
            {t("service.book")}
          </button>
        )}
      </div>
    </div>
  );
}

function PortfolioTile({
  photo,
  onOpen,
  canEdit,
  onReplace,
  onDelete,
}: {
  photo: PortfolioCard;
  onOpen: () => void;
  canEdit: boolean;
  onReplace: (f: File) => Promise<void> | void;
  onDelete: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function pick(f: File | null) {
    if (!f) return;
    setBusy(true);
    try {
      await onReplace(f);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="group relative aspect-square overflow-hidden rounded-md bg-surface">
      <button type="button" onClick={onOpen} className="absolute inset-0">
        <img
          src={photo.url}
          alt=""
          className="size-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
      </button>
      {canEdit && (
        <>
          <input
            ref={ref}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
          />
          <div className="absolute end-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <IconBtn onClick={() => ref.current?.click()} label="Replace">
              {busy ? <RefreshCw className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            </IconBtn>
            <IconBtn onClick={onDelete} label="Delete">
              <Trash2 className="size-3.5" />
            </IconBtn>
          </div>
        </>
      )}
    </div>
  );
}

function PortfolioAdd({ onUpload }: { onUpload: (f: File) => Promise<void> | void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function pick(f: File | null) {
    if (!f) return;
    setBusy(true);
    try {
      await onUpload(f);
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      onClick={() => ref.current?.click()}
      className="flex aspect-square items-center justify-center rounded-md border-2 border-dashed border-gold/40 bg-surface/40 text-gold transition-colors hover:border-gold/70 hover:bg-gold/5"
    >
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0] ?? null)}
      />
      {busy ? <RefreshCw className="size-6 animate-spin" /> : <Plus className="size-6" />}
    </button>
  );
}
