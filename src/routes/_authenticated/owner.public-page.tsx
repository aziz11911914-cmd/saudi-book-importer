import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  Loader2, Upload, Trash2, Image as ImageIcon, ExternalLink, Save,
  Plus, Eye, EyeOff, Star, ChevronUp, ChevronDown, Pencil, Users, Sparkles, Clock, MapPin,
} from "lucide-react";
import {
  getOwnerPublicPage, updateOwnerSalon,
  addGalleryPhoto, deleteGalleryPhoto, reorderGallery,
  toggleReviewHidden,
} from "@/lib/owner-salon.functions";
import { useOwnerMediaUpload } from "@/lib/use-owner-media-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const Route = createFileRoute("/_authenticated/owner/public-page")({
  component: PublicPageEditor,
});

function PublicPageEditor() {
  const qc = useQueryClient();
  const fetchPage = useServerFn(getOwnerPublicPage);
  const { data, isLoading, error } = useQuery({
    queryKey: ["owner", "public-page"],
    queryFn: () => fetchPage(),
  });
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["owner", "public-page"] });

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

  const previewUrl = `/shops/${data.shop.slug}`;

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-16">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Public Page</h1>
          <p className="text-sm text-muted-foreground">
            Edit exactly what customers see at{" "}
            <span className="text-gold">/shops/{data.shop.slug}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={data.shop.published ? "default" : "outline"}>
            {data.shop.published ? "Published" : "Hidden"}
          </Badge>
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110"
          >
            <ExternalLink className="size-4" /> Preview public page
          </a>
        </div>
      </header>

      <HeroSection shop={data.shop} hours={data.hours} onSaved={invalidate} />
      <GallerySection photos={data.photos} onChanged={invalidate} />
      <AboutSection shop={data.shop} onSaved={invalidate} />
      <ServicesSection services={data.services} />
      <TeamSection barbers={data.barbers} />
      <ReviewsSection reviews={data.reviews} onChanged={invalidate} />
    </div>
  );
}

/* ------------------ Hero (cover, logo, name, description, address, hours) ------------------ */
function HeroSection({ shop, hours, onSaved }: any) {
  const upload = useOwnerMediaUpload();
  const update = useServerFn(updateOwnerSalon);
  const m = useMutation({
    mutationFn: (patch: any) => update({ data: patch }),
    onSuccess: () => { toast.success("Saved"); onSaved(); },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });
  const [busy, setBusy] = useState<"logo" | "cover" | null>(null);
  const [form, setForm] = useState({
    name_en: shop.name_en ?? "",
    name_ar: shop.name_ar ?? "",
    address: shop.address ?? "",
  });

  async function pick(kind: "logo" | "cover") {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      if (f.size > 8 * 1024 * 1024) return toast.error("Max 8MB");
      setBusy(kind);
      try {
        const url = await upload(f, "salon-media");
        await m.mutateAsync(kind === "logo" ? { logo_url: url } : { cover_url: url });
      } catch (e: any) {
        toast.error(e?.message ?? "Upload failed");
      } finally { setBusy(null); }
    };
    input.click();
  }

  return (
    <SectionCard title="Hero" icon={<ImageIcon className="size-4" />}>
      {/* Cover with hero preview */}
      <div className="relative overflow-hidden rounded-xl border border-hairline">
        <div className="relative aspect-[3/1] w-full bg-surface">
          {shop.cover_url ? (
            <img src={shop.cover_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center text-muted-foreground">
              <ImageIcon className="size-10" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
            <div className="flex items-end gap-3">
              <div className="relative size-16 shrink-0 overflow-hidden rounded-xl border border-hairline bg-surface">
                {shop.logo_url ? (
                  <img src={shop.logo_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-muted-foreground">
                    <ImageIcon className="size-6" />
                  </div>
                )}
              </div>
              <div className="text-white drop-shadow">
                <div className="font-display text-xl leading-tight">{form.name_en || "Salon name"}</div>
                <div className="text-xs text-white/80">{form.name_ar}</div>
              </div>
            </div>
          </div>
          {busy && (
            <div className="absolute inset-0 grid place-items-center bg-black/50">
              <Loader2 className="size-6 animate-spin text-white" />
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 border-t border-hairline p-3">
          <Button size="sm" variant="outline" onClick={() => pick("cover")} disabled={!!busy}>
            <Upload className="me-2 size-4" /> Change cover
          </Button>
          {shop.cover_url && (
            <Button size="sm" variant="ghost" onClick={() => m.mutate({ cover_url: null })}>
              <Trash2 className="me-2 size-4" /> Remove cover
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => pick("logo")} disabled={!!busy}>
            <Upload className="me-2 size-4" /> Change logo
          </Button>
          {shop.logo_url && (
            <Button size="sm" variant="ghost" onClick={() => m.mutate({ logo_url: null })}>
              <Trash2 className="me-2 size-4" /> Remove logo
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <TField label="Salon name (English)" value={form.name_en} onChange={(v) => setForm({ ...form, name_en: v })} />
        <TField label="Salon name (Arabic)" value={form.name_ar} onChange={(v) => setForm({ ...form, name_ar: v })} />
      </div>
      <TField
        label="Address (shown in Hero)"
        value={form.address}
        onChange={(v) => setForm({ ...form, address: v })}
        icon={<MapPin className="size-4" />}
      />

      <div className="flex justify-end">
        <Button onClick={() => m.mutate(form)} disabled={m.isPending}>
          {m.isPending ? <Loader2 className="me-2 size-4 animate-spin" /> : <Save className="me-2 size-4" />}
          Save hero
        </Button>
      </div>

      {/* Opening hours summary */}
      <div className="rounded-xl border border-hairline p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Clock className="size-4" /> Opening hours
          </div>
          <Link to="/owner/salon" className="text-xs text-gold hover:underline">
            Edit hours →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
          {DAYS.map((d, i) => {
            const row = hours.find((h: any) => h.day_of_week === i);
            return (
              <div key={i} className="flex items-center justify-between">
                <span className="text-muted-foreground">{d}</span>
                <span>
                  {row ? `${row.opens_at?.slice(0, 5)}–${row.closes_at?.slice(0, 5)}` : "Closed"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </SectionCard>
  );
}

/* ------------------ Gallery ------------------ */
function GallerySection({ photos, onChanged }: any) {
  const upload = useOwnerMediaUpload();
  const add = useServerFn(addGalleryPhoto);
  const del = useServerFn(deleteGalleryPhoto);
  const reorder = useServerFn(reorderGallery);
  const [busy, setBusy] = useState(false);

  async function pick(replaceId?: string) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = !replaceId;
    input.onchange = async () => {
      const files = Array.from(input.files ?? []);
      if (!files.length) return;
      setBusy(true);
      try {
        if (replaceId) {
          const f = files[0];
          if (f.size > 8 * 1024 * 1024) return toast.error("Max 8MB");
          const url = await upload(f, "salon-media");
          await del({ data: { id: replaceId } });
          await add({ data: { url } });
        } else {
          for (const f of files) {
            if (f.size > 8 * 1024 * 1024) { toast.error(`${f.name} > 8MB`); continue; }
            const url = await upload(f, "salon-media");
            await add({ data: { url } });
          }
        }
        toast.success("Updated");
        onChanged();
      } catch (e: any) { toast.error(e?.message ?? "Upload failed"); }
      finally { setBusy(false); }
    };
    input.click();
  }

  async function move(idx: number, dir: -1 | 1) {
    const next = idx + dir;
    if (next < 0 || next >= photos.length) return;
    const order = photos.map((p: any) => p.id);
    [order[idx], order[next]] = [order[next], order[idx]];
    await reorder({ data: { order } });
    onChanged();
  }

  return (
    <SectionCard
      title={`Gallery (${photos.length})`}
      icon={<ImageIcon className="size-4" />}
      action={
        <Button size="sm" onClick={() => pick()} disabled={busy}>
          {busy ? <Loader2 className="me-2 size-4 animate-spin" /> : <Plus className="me-2 size-4" />}
          Add photos
        </Button>
      }
    >
      {photos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-hairline p-8 text-center text-sm text-muted-foreground">
          No photos yet.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((p: any, i: number) => (
            <div key={p.id} className="group relative aspect-square overflow-hidden rounded-xl border border-hairline">
              <img src={p.url} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/70 p-1 opacity-0 transition group-hover:opacity-100">
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="size-7 text-white" onClick={() => move(i, -1)} disabled={i === 0}>
                    <ChevronUp className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="size-7 text-white" onClick={() => move(i, 1)} disabled={i === photos.length - 1}>
                    <ChevronDown className="size-4" />
                  </Button>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="size-7 text-white" onClick={() => pick(p.id)} title="Replace">
                    <Upload className="size-4" />
                  </Button>
                  <Button
                    size="icon" variant="ghost" className="size-7 text-white"
                    onClick={async () => { await del({ data: { id: p.id } }); onChanged(); }}
                    title="Delete"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

/* ------------------ About ------------------ */
function AboutSection({ shop, onSaved }: any) {
  const update = useServerFn(updateOwnerSalon);
  const m = useMutation({
    mutationFn: (patch: any) => update({ data: patch }),
    onSuccess: () => { toast.success("Saved"); onSaved(); },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });
  const [form, setForm] = useState({
    description_en: shop.description_en ?? "",
    description_ar: shop.description_ar ?? "",
  });
  return (
    <SectionCard title="About" icon={<Pencil className="size-4" />}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Description (English)</Label>
          <Textarea rows={4} value={form.description_en} onChange={(e) => setForm({ ...form, description_en: e.target.value })} />
        </div>
        <div>
          <Label>Description (Arabic)</Label>
          <Textarea rows={4} value={form.description_ar} onChange={(e) => setForm({ ...form, description_ar: e.target.value })} />
        </div>
      </div>
      <div className="flex justify-end">
        <Button onClick={() => m.mutate(form)} disabled={m.isPending}>
          {m.isPending ? <Loader2 className="me-2 size-4 animate-spin" /> : <Save className="me-2 size-4" />}
          Save about
        </Button>
      </div>
    </SectionCard>
  );
}

/* ------------------ Services ------------------ */
function ServicesSection({ services }: any) {
  return (
    <SectionCard
      title={`Services (${services.length})`}
      icon={<Sparkles className="size-4" />}
      action={
        <Link to="/owner/services" className="inline-flex items-center gap-1 rounded-full border border-hairline px-3 py-1.5 text-xs hover:bg-surface">
          <Pencil className="size-3" /> Manage services
        </Link>
      }
    >
      {services.length === 0 ? (
        <p className="rounded-xl border border-dashed border-hairline p-8 text-center text-sm text-muted-foreground">
          No services yet. <Link to="/owner/services" className="text-gold hover:underline">Add your first service →</Link>
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {services.slice(0, 8).map((s: any) => (
            <div key={s.id} className="flex items-center gap-3 rounded-xl border border-hairline p-3">
              <div className="size-12 shrink-0 overflow-hidden rounded-lg border border-hairline bg-surface">
                {s.image_url ? (
                  <img src={s.image_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-muted-foreground">
                    <Sparkles className="size-4" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{s.name_en}</div>
                <div className="truncate text-xs text-muted-foreground">{s.name_ar}</div>
              </div>
              <div className="text-right text-xs">
                <div className="font-medium">{s.price_sar} SAR</div>
                <div className="text-muted-foreground">{s.duration_min} min</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

/* ------------------ Team ------------------ */
function TeamSection({ barbers }: any) {
  return (
    <SectionCard
      title={`Team (${barbers.length})`}
      icon={<Users className="size-4" />}
      action={
        <Link to="/owner/barbers" className="inline-flex items-center gap-1 rounded-full border border-hairline px-3 py-1.5 text-xs hover:bg-surface">
          <Pencil className="size-3" /> Manage team
        </Link>
      }
    >
      {barbers.length === 0 ? (
        <p className="rounded-xl border border-dashed border-hairline p-8 text-center text-sm text-muted-foreground">
          No barbers yet.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {barbers.map((b: any) => (
            <div key={b.id} className="overflow-hidden rounded-xl border border-hairline">
              <div className="aspect-square bg-surface">
                {b.photo_url ? (
                  <img src={b.photo_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-muted-foreground">
                    <Users className="size-8" />
                  </div>
                )}
              </div>
              <div className="p-2 text-center">
                <div className="truncate text-xs font-medium">{b.display_name_en}</div>
                <div className="truncate text-[10px] text-muted-foreground">{b.display_name_ar}</div>
                {b.status !== "active" && (
                  <Badge variant="outline" className="mt-1 text-[10px]">{b.status}</Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

/* ------------------ Reviews ------------------ */
function ReviewsSection({ reviews, onChanged }: any) {
  const toggle = useServerFn(toggleReviewHidden);
  const m = useMutation({
    mutationFn: (v: { id: string; hidden: boolean }) => toggle({ data: v }),
    onSuccess: () => { toast.success("Updated"); onChanged(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  return (
    <SectionCard title={`Reviews (${reviews.length})`} icon={<Star className="size-4" />}>
      {reviews.length === 0 ? (
        <p className="rounded-xl border border-dashed border-hairline p-8 text-center text-sm text-muted-foreground">
          No reviews yet.
        </p>
      ) : (
        <ul className="divide-y divide-hairline rounded-xl border border-hairline">
          {reviews.map((r: any) => (
            <li key={r.id} className={cn("p-3 text-sm", r.hidden_at && "opacity-60")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="flex">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={cn("size-3", i < r.rating ? "fill-gold text-gold" : "text-muted-foreground")} />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {r.profiles?.full_name ?? "Customer"} · {new Date(r.created_at).toLocaleDateString()}
                    </span>
                    {r.hidden_at && <Badge variant="outline" className="text-[10px]">Hidden</Badge>}
                  </div>
                  {r.comment && <p className="mt-1 text-sm">{r.comment}</p>}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => m.mutate({ id: r.id, hidden: !r.hidden_at })}
                  disabled={m.isPending}
                >
                  {r.hidden_at ? <><Eye className="me-1 size-4" /> Show</> : <><EyeOff className="me-1 size-4" /> Hide</>}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

/* ------------------ helpers ------------------ */
function SectionCard({
  title, icon, action, children,
}: { title: string; icon?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg">
          {icon} {title}
        </h2>
        {action}
      </div>
      {children}
    </Card>
  );
}
function TField({
  label, value, onChange, icon,
}: { label: string; value: string; onChange: (v: string) => void; icon?: React.ReactNode }) {
  return (
    <div>
      <Label className="flex items-center gap-2">{icon}{label}</Label>
      <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
