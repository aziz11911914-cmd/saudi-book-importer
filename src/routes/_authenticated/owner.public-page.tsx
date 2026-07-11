import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getOwnerPublicPage,
  updateOwnerSalon,
  updateShopHours,
  addGalleryPhoto,
  deleteGalleryPhoto,
  reorderGallery,
  toggleReviewHidden,
  upsertOwnerService,
  deleteOwnerService,
  upsertOwnerBarber,
  deleteOwnerBarber,
} from "@/lib/owner-salon.functions";
import { useOwnerMediaUpload } from "@/lib/use-owner-media-upload";
import { ShopPublicView, type PublicReview } from "@/components/shop/shop-public-view";
import {
  TextDialog,
  TextPairDialog,
  LocationDialog,
  HoursDialog,
  ServiceDialog,
  BarberDialog,
  Confirm,
  type ServiceForm,
  type BarberForm,
} from "@/components/shop/inline-editors";

export const Route = createFileRoute("/_authenticated/owner/public-page")({
  component: PublicPageEditor,
});

function pickFile(accept = "image/*"): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

type Dlg =
  | { kind: "none" }
  | { kind: "name" }
  | { kind: "address" }
  | { kind: "description" }
  | { kind: "location" }
  | { kind: "hours" }
  | { kind: "service"; value: ServiceForm | null }
  | { kind: "delete-service"; id: string; name: string }
  | { kind: "barber"; value: BarberForm | null }
  | { kind: "delete-barber"; id: string; name: string }
  | { kind: "delete-photo"; id: string };

function PublicPageEditor() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  const fetchPage = useServerFn(getOwnerPublicPage);
  const upload = useOwnerMediaUpload();
  const updateFn = useServerFn(updateOwnerSalon);
  const updateHoursFn = useServerFn(updateShopHours);
  const addPhotoFn = useServerFn(addGalleryPhoto);
  const delPhotoFn = useServerFn(deleteGalleryPhoto);
  const reorderFn = useServerFn(reorderGallery);
  const toggleReviewFn = useServerFn(toggleReviewHidden);
  const upsertServiceFn = useServerFn(upsertOwnerService);
  const deleteServiceFn = useServerFn(deleteOwnerService);
  const upsertBarberFn = useServerFn(upsertOwnerBarber);
  const deleteBarberFn = useServerFn(deleteOwnerBarber);

  const [dlg, setDlg] = useState<Dlg>({ kind: "none" });
  const [uploading, setUploading] = useState(false);
  const close = () => setDlg({ kind: "none" });

  const KEY = ["owner", "public-page"] as const;
  const { data, isLoading, error } = useQuery({
    queryKey: KEY,
    queryFn: () => fetchPage(),
    staleTime: 30_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: KEY });

  const updateM = useMutation({
    mutationFn: (patch: any) => updateFn({ data: patch }),
    onSuccess: (updated) => {
      qc.setQueryData(KEY, (old: any) => old ? { ...old, shop: updated } : old);
      toast.success(t("owner.publicPage.saved"));
    },
    onError: (e: any) => toast.error(e?.message ?? t("owner.publicPage.uploadFailed")),
  });

  if (isLoading) {
    return (
      <div className="grid place-items-center py-20 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="rounded-2xl border border-hairline bg-surface p-6 text-sm text-muted-foreground">
        Unable to load public page: {(error as any)?.message ?? "no salon assigned"}
      </div>
    );
  }

  const MAX = 8 * 1024 * 1024;
  const ACCEPT = "image/jpeg,image/jpg,image/png,image/webp";
  const isImage = (f: File) => /^image\/(jpeg|jpg|png|webp)$/i.test(f.type);

  async function uploadImage(kind: "cover" | "logo") {
    const f = await pickFile(ACCEPT);
    if (!f) return;
    if (!isImage(f)) return toast.error("Only JPG, PNG or WEBP");
    if (f.size > MAX) return toast.error("Max 8MB");
    setUploading(true);
    try {
      const url = await upload(f, "salon-media");
      updateM.mutate(kind === "cover" ? { cover_url: url } : { logo_url: url });
    } catch (e: any) { toast.error(e?.message ?? "Upload failed"); }
    finally { setUploading(false); }
  }

  async function addPhoto() {
    const f = await pickFile(ACCEPT);
    if (!f) return;
    if (!isImage(f)) return toast.error("Only JPG, PNG or WEBP");
    if (f.size > MAX) return toast.error("Max 8MB");
    const tempId = `temp-${Date.now()}`;
    const tempUrl = URL.createObjectURL(f);
    qc.setQueryData(KEY, (old: any) => old
      ? { ...old, photos: [...old.photos, { id: tempId, url: tempUrl, sort: old.photos.length, pending: true }] }
      : old);
    try {
      const url = await upload(f, "salon-media");
      const row = await addPhotoFn({ data: { url } });
      qc.setQueryData(KEY, (old: any) => old
        ? { ...old, photos: old.photos.map((p: any) => p.id === tempId ? row : p) }
        : old);
    } catch (e: any) {
      qc.setQueryData(KEY, (old: any) => old
        ? { ...old, photos: old.photos.filter((p: any) => p.id !== tempId) }
        : old);
      toast.error(e?.message ?? "Upload failed");
    } finally {
      URL.revokeObjectURL(tempUrl);
    }
  }

  async function replacePhoto(id: string) {
    const f = await pickFile(ACCEPT);
    if (!f) return;
    if (!isImage(f)) return toast.error("Only JPG, PNG or WEBP");
    if (f.size > MAX) return toast.error("Max 8MB");
    const tempUrl = URL.createObjectURL(f);
    qc.setQueryData(KEY, (old: any) => old
      ? { ...old, photos: old.photos.map((p: any) => p.id === id ? { ...p, url: tempUrl, pending: true } : p) }
      : old);
    try {
      const url = await upload(f, "salon-media");
      await delPhotoFn({ data: { id } });
      const row = await addPhotoFn({ data: { url } });
      qc.setQueryData(KEY, (old: any) => old
        ? { ...old, photos: old.photos.filter((p: any) => p.id !== id).concat(row) }
        : old);
    } catch (e: any) {
      qc.setQueryData(KEY, (old: any) => old
        ? { ...old, photos: old.photos.map((p: any) => p.id === id ? { ...p, pending: false } : p) }
        : old);
      toast.error(e?.message ?? "Replace failed");
    } finally {
      URL.revokeObjectURL(tempUrl);
    }
  }

  async function movePhoto(id: string, dir: -1 | 1) {
    const order = data!.photos.map((p: any) => p.id);
    const idx = order.indexOf(id);
    const next = idx + dir;
    if (idx < 0 || next < 0 || next >= order.length) return;
    [order[idx], order[next]] = [order[next], order[idx]];
    qc.setQueryData(KEY, (old: any) => old
      ? { ...old, photos: order.map((pid: string) => old.photos.find((p: any) => p.id === pid)) }
      : old);
    await reorderFn({ data: { order } });
  }

  const reviews: PublicReview[] = (data.reviews ?? []).map((r: any) => ({
    id: r.id,
    reviewer_name: r.profiles?.full_name ?? "Customer",
    rating: r.rating,
    comment: r.comment ?? "",
    created_at: r.created_at,
    hidden: !!r.hidden_at,
  }));

  return (
    <div className="-m-4 sm:-m-6">
      <ShopPublicView
        shop={data.shop as never}
        hours={data.hours as never}
        photos={data.photos as never}
        services={data.services as never}
        barbers={data.barbers as never}
        reviews={reviews}
        editMode
        edit={{
          onEditCover: () => uploadImage("cover"),
          onRemoveCover: () => updateM.mutate({ cover_url: null }),
          onEditLogo: () => uploadImage("logo"),
          onEditName: () => setDlg({ kind: "name" }),
          onEditAddress: () => setDlg({ kind: "address" }),
          onEditDescription: () => setDlg({ kind: "description" }),
          onEditHours: () => setDlg({ kind: "hours" }),
          onEditLocation: () => setDlg({ kind: "location" }),
          onAddPhoto: addPhoto,
          onReplacePhoto: replacePhoto,
          onDeletePhoto: (id) => setDlg({ kind: "delete-photo", id }),
          onMovePhoto: movePhoto,
          onAddService: () => setDlg({ kind: "service", value: null }),
          onEditService: (id) => {
            const s: any = data.services.find((x: any) => x.id === id);
            if (!s) return;
            setDlg({ kind: "service", value: {
              id: s.id, name_en: s.name_en, name_ar: s.name_ar,
              price_sar: Number(s.price_sar), duration_min: Number(s.duration_min),
            }});
          },
          onDeleteService: (id) => {
            const s: any = data.services.find((x: any) => x.id === id);
            setDlg({ kind: "delete-service", id, name: s?.name_en ?? "" });
          },
          onAddBarber: () => setDlg({ kind: "barber", value: null }),
          onEditBarber: (id) => {
            const b: any = data.barbers.find((x: any) => x.id === id);
            if (!b) return;
            setDlg({ kind: "barber", value: {
              id: b.id, display_name_en: b.display_name_en, display_name_ar: b.display_name_ar,
              title_en: b.title_en ?? "Barber", title_ar: b.title_ar ?? "حلاق",
              photo_url: b.photo_url,
            }});
          },
          onDeleteBarber: (id) => {
            const b: any = data.barbers.find((x: any) => x.id === id);
            setDlg({ kind: "delete-barber", id, name: b?.display_name_en ?? "" });
          },
          onToggleReviewHidden: async (id, hidden) => {
            qc.setQueryData(KEY, (old: any) => old ? {
              ...old,
              reviews: old.reviews.map((r: any) =>
                r.id === id ? { ...r, hidden_at: hidden ? new Date().toISOString() : null } : r),
            } : old);
            await toggleReviewFn({ data: { id, hidden } });
          },
        }}
        showBookingBar={false}
      />

      {/* --------- dialogs --------- */}
      <TextPairDialog
        open={dlg.kind === "name"}
        onOpenChange={close}
        title={t("owner.editors.salonName")}
        labelEn={t("owner.editors.nameEn")}
        labelAr={t("owner.editors.nameAr")}
        valueEn={data.shop.name_en ?? ""}
        valueAr={data.shop.name_ar ?? ""}
        onSave={async ({ en, ar }) => { await updateM.mutateAsync({ name_en: en, name_ar: ar }); }}
      />
      <TextPairDialog
        open={dlg.kind === "description"}
        onOpenChange={close}
        title={t("owner.editors.about")}
        labelEn={t("owner.editors.descEn")}
        labelAr={t("owner.editors.descAr")}
        valueEn={data.shop.description_en ?? ""}
        valueAr={data.shop.description_ar ?? ""}
        multiline
        onSave={async ({ en, ar }) => {
          await updateM.mutateAsync({ description_en: en || null, description_ar: ar || null });
        }}
      />
      <TextDialog
        open={dlg.kind === "address"}
        onOpenChange={close}
        title={t("owner.editors.address")}
        label={t("owner.editors.address")}
        value={data.shop.address ?? ""}
        onSave={async (v) => { await updateM.mutateAsync({ address: v.trim() || null }); }}
      />
      <LocationDialog
        open={dlg.kind === "location"}
        onOpenChange={close}
        address={data.shop.address ?? ""}
        lat={data.shop.lat as any}
        lng={data.shop.lng as any}
        onSave={async ({ address, lat, lng }) => {
          await updateM.mutateAsync({ address: address || null, lat, lng });
        }}
      />
      <HoursDialog
        open={dlg.kind === "hours"}
        onOpenChange={close}
        hours={data.hours as any}
        onSave={async (rows) => {
          await updateHoursFn({ data: { hours: rows } });
          const next = rows.filter((r) => !r.closed).map((r) => ({
            day_of_week: r.day_of_week, opens_at: r.opens_at, closes_at: r.closes_at,
          }));
          qc.setQueryData(KEY, (old: any) => old ? { ...old, hours: next } : old);
          toast.success(t("owner.publicPage.saved"));
        }}
      />
      <ServiceDialog
        open={dlg.kind === "service"}
        onOpenChange={close}
        value={dlg.kind === "service" ? dlg.value : null}
        onSave={async (v) => {
          const res = await upsertServiceFn({ data: v });
          qc.setQueryData(KEY, (old: any) => {
            if (!old) return old;
            const svc = { id: (res as any).id, name_en: v.name_en, name_ar: v.name_ar,
              price_sar: v.price_sar, duration_min: v.duration_min, image_url: null,
              status: "active", display_order: 0 };
            const exists = old.services.some((s: any) => s.id === svc.id);
            return {
              ...old,
              services: exists
                ? old.services.map((s: any) => s.id === svc.id ? { ...s, ...svc } : s)
                : [...old.services, svc],
            };
          });
          toast.success(t("owner.publicPage.saved"));
        }}
      />
      <Confirm
        open={dlg.kind === "delete-service"}
        onOpenChange={close}
        title={t("owner.editors.deleteService")}
        description={dlg.kind === "delete-service" ? t("owner.editors.deleteServiceBody", { name: dlg.name }) : ""}
        onConfirm={async () => {
          if (dlg.kind !== "delete-service") return;
          const id = dlg.id;
          await deleteServiceFn({ data: { id } });
          qc.setQueryData(KEY, (old: any) => old
            ? { ...old, services: old.services.filter((s: any) => s.id !== id) }
            : old);
          toast.success(t("owner.publicPage.saved"));
        }}
      />
      <BarberDialog
        open={dlg.kind === "barber"}
        onOpenChange={close}
        value={dlg.kind === "barber" ? dlg.value : null}
        uploading={uploading}
        onPickPhoto={async () => {
          const f = await pickFile(ACCEPT);
          if (!f) return null;
          if (!isImage(f)) { toast.error(t("owner.publicPage.onlyImages")); return null; }
          if (f.size > MAX) { toast.error(t("owner.publicPage.maxSize")); return null; }
          setUploading(true);
          try { return await upload(f, "salon-media"); }
          catch (e: any) { toast.error(e?.message ?? t("owner.publicPage.uploadFailed")); return null; }
          finally { setUploading(false); }
        }}
        onSave={async (v) => {
          const res = await upsertBarberFn({ data: v });
          qc.setQueryData(KEY, (old: any) => {
            if (!old) return old;
            const b = { id: (res as any).id, display_name_en: v.display_name_en,
              display_name_ar: v.display_name_ar, title_en: v.title_en, title_ar: v.title_ar,
              photo_url: v.photo_url, status: "active", rating_avg: 0, featured: false };
            const exists = old.barbers.some((x: any) => x.id === b.id);
            return {
              ...old,
              barbers: exists
                ? old.barbers.map((x: any) => x.id === b.id ? { ...x, ...b } : x)
                : [...old.barbers, b],
            };
          });
          toast.success(t("owner.publicPage.saved"));
        }}
      />
      <Confirm
        open={dlg.kind === "delete-barber"}
        onOpenChange={close}
        title={t("owner.editors.removeBarber")}
        confirmLabel={t("owner.editors.removeConfirm")}
        description={dlg.kind === "delete-barber" ? t("owner.editors.removeBarberBody", { name: dlg.name }) : ""}
        onConfirm={async () => {
          if (dlg.kind !== "delete-barber") return;
          const id = dlg.id;
          await deleteBarberFn({ data: { id } });
          qc.setQueryData(KEY, (old: any) => old
            ? { ...old, barbers: old.barbers.filter((b: any) => b.id !== id) }
            : old);
          toast.success(t("owner.publicPage.saved"));
        }}
      />
      <Confirm
        open={dlg.kind === "delete-photo"}
        onOpenChange={close}
        title={t("owner.editors.deletePhoto")}
        description={t("owner.editors.deletePhotoBody")}
        onConfirm={async () => {
          if (dlg.kind !== "delete-photo") return;
          const id = dlg.id;
          await delPhotoFn({ data: { id } });
          qc.setQueryData(KEY, (old: any) => old
            ? { ...old, photos: old.photos.filter((p: any) => p.id !== id) }
            : old);
        }}
      />
      {(updateM.isPending || uploading) && (
        <div className="pointer-events-none fixed bottom-4 end-4 z-50 flex items-center gap-2 rounded-full bg-background/90 px-3 py-1.5 text-xs text-muted-foreground shadow">
          <Loader2 className="size-3.5 animate-spin" /> {t("owner.publicPage.saving")}
        </div>
      )}
      {/* keep invalidate reachable to avoid unused-warning */}
      <span hidden aria-hidden onClick={invalidate} />
    </div>
  );
}
