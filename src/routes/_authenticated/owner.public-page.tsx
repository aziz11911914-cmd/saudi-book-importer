import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  getOwnerPublicPage,
  updateOwnerSalon,
  addGalleryPhoto,
  deleteGalleryPhoto,
  reorderGallery,
  toggleReviewHidden,
} from "@/lib/owner-salon.functions";
import { useOwnerMediaUpload } from "@/lib/use-owner-media-upload";
import { ShopPublicView, type PublicReview } from "@/components/shop/shop-public-view";

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

function PublicPageEditor() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fetchPage = useServerFn(getOwnerPublicPage);
  const upload = useOwnerMediaUpload();
  const updateFn = useServerFn(updateOwnerSalon);
  const addPhotoFn = useServerFn(addGalleryPhoto);
  const delPhotoFn = useServerFn(deleteGalleryPhoto);
  const reorderFn = useServerFn(reorderGallery);
  const toggleReviewFn = useServerFn(toggleReviewHidden);

  const { data, isLoading, error } = useQuery({
    queryKey: ["owner", "public-page"],
    queryFn: () => fetchPage(),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["owner", "public-page"] });

  const updateM = useMutation({
    mutationFn: (patch: any) => updateFn({ data: patch }),
    onSuccess: () => { toast.success("Saved"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
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

  async function uploadImage(kind: "cover" | "logo") {
    const f = await pickFile();
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) return toast.error("Max 8MB");
    try {
      const url = await upload(f, "salon-media");
      updateM.mutate(kind === "cover" ? { cover_url: url } : { logo_url: url });
    } catch (e: any) { toast.error(e?.message ?? "Upload failed"); }
  }

  async function addPhoto() {
    const f = await pickFile();
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) return toast.error("Max 8MB");
    try {
      const url = await upload(f, "salon-media");
      await addPhotoFn({ data: { url } });
      toast.success("Photo added");
      invalidate();
    } catch (e: any) { toast.error(e?.message ?? "Upload failed"); }
  }

  async function replacePhoto(id: string) {
    const f = await pickFile();
    if (!f) return;
    try {
      const url = await upload(f, "salon-media");
      await delPhotoFn({ data: { id } });
      await addPhotoFn({ data: { url } });
      invalidate();
    } catch (e: any) { toast.error(e?.message ?? "Replace failed"); }
  }

  async function deletePhoto(id: string) {
    if (!confirm("Delete this photo?")) return;
    await delPhotoFn({ data: { id } });
    invalidate();
  }

  async function movePhoto(id: string, dir: -1 | 1) {
    const order = data!.photos.map((p: any) => p.id);
    const idx = order.indexOf(id);
    const next = idx + dir;
    if (idx < 0 || next < 0 || next >= order.length) return;
    [order[idx], order[next]] = [order[next], order[idx]];
    await reorderFn({ data: { order } });
    invalidate();
  }

  function editText(label: string, current: string | null, field: string) {
    const v = prompt(label, current ?? "");
    if (v === null) return;
    updateM.mutate({ [field]: v.trim() || null });
  }

  function editName() {
    const en = prompt("Salon name (English)", data!.shop.name_en ?? "");
    if (en === null) return;
    const ar = prompt("Salon name (Arabic)", data!.shop.name_ar ?? "");
    if (ar === null) return;
    updateM.mutate({ name_en: en, name_ar: ar });
  }

  function editDescription() {
    const en = prompt("Description (English)", data!.shop.description_en ?? "");
    if (en === null) return;
    const ar = prompt("Description (Arabic)", data!.shop.description_ar ?? "");
    if (ar === null) return;
    updateM.mutate({ description_en: en || null, description_ar: ar || null });
  }

  function editLocation() {
    const lat = prompt("Latitude", String(data!.shop.lat ?? ""));
    if (lat === null) return;
    const lng = prompt("Longitude", String(data!.shop.lng ?? ""));
    if (lng === null) return;
    const latN = parseFloat(lat);
    const lngN = parseFloat(lng);
    if (Number.isNaN(latN) || Number.isNaN(lngN)) return toast.error("Invalid coordinates");
    updateM.mutate({ lat: latN, lng: lngN });
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
          onEditName: editName,
          onEditAddress: () => editText("Address", data.shop.address, "address"),
          onEditDescription: editDescription,
          onEditHours: () => navigate({ to: "/owner/salon" }),
          onEditLocation: editLocation,
          onAddPhoto: addPhoto,
          onReplacePhoto: replacePhoto,
          onDeletePhoto: deletePhoto,
          onMovePhoto: movePhoto,
          onAddService: () => navigate({ to: "/owner/services" }),
          onEditService: () => navigate({ to: "/owner/services" }),
          onDeleteService: () => navigate({ to: "/owner/services" }),
          onAddBarber: () => navigate({ to: "/owner/barbers" }),
          onEditBarber: () => navigate({ to: "/owner/barbers" }),
          onDeleteBarber: () => navigate({ to: "/owner/barbers" }),
          onToggleReviewHidden: async (id, hidden) => {
            await toggleReviewFn({ data: { id, hidden } });
            invalidate();
          },
        }}
        showBookingBar={false}
      />
    </div>
  );
}
