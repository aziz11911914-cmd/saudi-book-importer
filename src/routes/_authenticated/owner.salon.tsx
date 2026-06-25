import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Loader2, Image as ImageIcon, Trash2, Upload, MapPin, Phone, Globe,
  Clock, CalendarOff, Settings as SettingsIcon, Eye, EyeOff,
  AlertTriangle, Save, Plus, X, Copy, ExternalLink,
} from "lucide-react";
import {
  getOwnerSalon, updateOwnerSalon, updateShopHours,
  upsertHoliday, deleteHoliday,
  addGalleryPhoto, deleteGalleryPhoto, reorderGallery,
  requestSalonDeletion, archiveSalon, unarchiveSalon,
} from "@/lib/owner-salon.functions";
import { useOwnerMediaUpload } from "@/lib/use-owner-media-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const Route = createFileRoute("/_authenticated/owner/salon")({
  component: SalonPage,
});

function SalonPage() {
  const qc = useQueryClient();
  const fetchSalon = useServerFn(getOwnerSalon);
  const { data, isLoading, error } = useQuery({
    queryKey: ["owner", "salon"],
    queryFn: () => fetchSalon(),
  });

  if (isLoading) {
    return <div className="grid place-items-center py-20 text-muted-foreground"><Loader2 className="size-6 animate-spin" /></div>;
  }
  if (error || !data) {
    return <div className="rounded-2xl border border-hairline bg-surface p-6 text-sm text-muted-foreground">Unable to load salon: {(error as any)?.message ?? "no salon assigned"}</div>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">{data.shop.name_en}</h1>
          <p className="text-sm text-muted-foreground">
            {data.shop.name_ar} · /{data.shop.slug}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={data.shop.published ? "default" : "outline"}>
            {data.shop.published ? "Published" : "Hidden"}
          </Badge>
          {data.shop.paused_bookings && <Badge variant="destructive">Bookings paused</Badge>}
          {data.shop.archived_at && <Badge variant="destructive">Archived</Badge>}
          <a
            href={`/salons/${data.shop.slug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full border border-hairline px-3 py-1.5 text-xs hover:bg-surface"
          >
            <ExternalLink className="size-3" /> Preview
          </a>
        </div>
      </header>

      <Tabs defaultValue="general">
        <TabsList className="flex w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="gallery">Gallery</TabsTrigger>
          <TabsTrigger value="location">Location</TabsTrigger>
          <TabsTrigger value="hours">Hours</TabsTrigger>
          <TabsTrigger value="holidays">Holidays</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="visibility">Visibility</TabsTrigger>
          <TabsTrigger value="danger">Danger zone</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4 pt-4">
          <GeneralSection shop={data.shop} onSaved={() => qc.invalidateQueries({ queryKey: ["owner", "salon"] })} />
        </TabsContent>
        <TabsContent value="branding" className="space-y-4 pt-4">
          <BrandingSection shop={data.shop} onSaved={() => qc.invalidateQueries({ queryKey: ["owner", "salon"] })} />
        </TabsContent>
        <TabsContent value="gallery" className="space-y-4 pt-4">
          <GallerySection photos={data.photos} onChanged={() => qc.invalidateQueries({ queryKey: ["owner", "salon"] })} />
        </TabsContent>
        <TabsContent value="location" className="space-y-4 pt-4">
          <LocationSection shop={data.shop} onSaved={() => qc.invalidateQueries({ queryKey: ["owner", "salon"] })} />
        </TabsContent>
        <TabsContent value="hours" className="space-y-4 pt-4">
          <HoursSection hours={data.hours} onSaved={() => qc.invalidateQueries({ queryKey: ["owner", "salon"] })} />
        </TabsContent>
        <TabsContent value="holidays" className="space-y-4 pt-4">
          <HolidaysSection holidays={data.holidays} onChanged={() => qc.invalidateQueries({ queryKey: ["owner", "salon"] })} />
        </TabsContent>
        <TabsContent value="features" className="space-y-4 pt-4">
          <FeaturesSection shop={data.shop} onSaved={() => qc.invalidateQueries({ queryKey: ["owner", "salon"] })} />
        </TabsContent>
        <TabsContent value="visibility" className="space-y-4 pt-4">
          <VisibilitySection shop={data.shop} onSaved={() => qc.invalidateQueries({ queryKey: ["owner", "salon"] })} />
        </TabsContent>
        <TabsContent value="danger" className="space-y-4 pt-4">
          <DangerZone shop={data.shop} onChanged={() => qc.invalidateQueries({ queryKey: ["owner", "salon"] })} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------- General ----------------
function useUpdate(onSaved: () => void) {
  const update = useServerFn(updateOwnerSalon);
  return useMutation({
    mutationFn: (patch: any) => update({ data: patch }),
    onSuccess: () => { toast.success("Saved"); onSaved(); },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });
}

function GeneralSection({ shop, onSaved }: { shop: any; onSaved: () => void }) {
  const [form, setForm] = useState(() => ({
    name_en: shop.name_en ?? "",
    name_ar: shop.name_ar ?? "",
    description_en: shop.description_en ?? "",
    description_ar: shop.description_ar ?? "",
    phone: shop.phone ?? "",
    whatsapp: shop.whatsapp ?? "",
    email: shop.email ?? "",
    website: shop.website ?? "",
    instagram: shop.instagram ?? "",
    snapchat: shop.snapchat ?? "",
    tiktok: shop.tiktok ?? "",
  }));
  const m = useUpdate(onSaved);

  return (
    <Card className="space-y-5 p-5">
      <Section title="Identity">
        <Pair>
          <Field label="Salon Name (English)" required value={form.name_en} onChange={(v) => setForm({ ...form, name_en: v })} />
          <Field label="Salon Name (Arabic)" required value={form.name_ar} onChange={(v) => setForm({ ...form, name_ar: v })} />
        </Pair>
        <Pair>
          <TextArea label="Description (English)" value={form.description_en} onChange={(v) => setForm({ ...form, description_en: v })} />
          <TextArea label="Description (Arabic)" value={form.description_ar} onChange={(v) => setForm({ ...form, description_ar: v })} />
        </Pair>
      </Section>
      <Section title="Contact">
        <Pair>
          <Field label="Phone" required value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          <Field label="WhatsApp" value={form.whatsapp} onChange={(v) => setForm({ ...form, whatsapp: v })} />
        </Pair>
        <Pair>
          <Field label="Email" type="email" required value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <Field label="Website" type="url" value={form.website} onChange={(v) => setForm({ ...form, website: v })} />
        </Pair>
      </Section>
      <Section title="Social">
        <Pair>
          <Field label="Instagram" value={form.instagram} onChange={(v) => setForm({ ...form, instagram: v })} />
          <Field label="Snapchat" value={form.snapchat} onChange={(v) => setForm({ ...form, snapchat: v })} />
        </Pair>
        <Pair>
          <Field label="TikTok" value={form.tiktok} onChange={(v) => setForm({ ...form, tiktok: v })} />
          <div />
        </Pair>
      </Section>
      <div className="flex justify-end">
        <Button onClick={() => m.mutate(form)} disabled={m.isPending}>
          {m.isPending ? <Loader2 className="me-2 size-4 animate-spin" /> : <Save className="me-2 size-4" />}
          Save changes
        </Button>
      </div>
    </Card>
  );
}

// ---------------- Branding ----------------
function BrandingSection({ shop, onSaved }: { shop: any; onSaved: () => void }) {
  const upload = useOwnerMediaUpload();
  const m = useUpdate(onSaved);
  const [busy, setBusy] = useState<"logo" | "cover" | null>(null);
  async function pick(kind: "logo" | "cover") {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      if (f.size > 8 * 1024 * 1024) {
        toast.error("Max 8MB");
        return;
      }
      setBusy(kind);
      try {
        const url = await upload(f, "salon-media");
        await m.mutateAsync(kind === "logo" ? { logo_url: url } : { cover_url: url });
      } catch (e: any) {
        toast.error(e?.message ?? "Upload failed");
      } finally {
        setBusy(null);
      }
    };
    input.click();
  }
  return (
    <Card className="grid gap-5 p-5 sm:grid-cols-2">
      <MediaSlot
        label="Logo"
        url={shop.logo_url}
        aspect="square"
        busy={busy === "logo"}
        onUpload={() => pick("logo")}
        onClear={() => m.mutate({ logo_url: null })}
      />
      <MediaSlot
        label="Cover image"
        url={shop.cover_url}
        aspect="cover"
        busy={busy === "cover"}
        onUpload={() => pick("cover")}
        onClear={() => m.mutate({ cover_url: null })}
      />
    </Card>
  );
}

function MediaSlot({ label, url, aspect, busy, onUpload, onClear }: any) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className={cn("relative overflow-hidden rounded-xl border border-hairline bg-surface", aspect === "square" ? "aspect-square" : "aspect-[3/1]")}>
        {url ? (
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-muted-foreground">
            <ImageIcon className="size-8" />
          </div>
        )}
        {busy && <div className="absolute inset-0 grid place-items-center bg-black/50"><Loader2 className="size-6 animate-spin text-white" /></div>}
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={onUpload} disabled={busy}><Upload className="me-2 size-4" />Upload</Button>
        {url && <Button size="sm" variant="ghost" onClick={onClear}><Trash2 className="me-2 size-4" />Remove</Button>}
      </div>
    </div>
  );
}

// ---------------- Gallery ----------------
function GallerySection({ photos, onChanged }: { photos: any[]; onChanged: () => void }) {
  const upload = useOwnerMediaUpload();
  const add = useServerFn(addGalleryPhoto);
  const del = useServerFn(deleteGalleryPhoto);
  const reorder = useServerFn(reorderGallery);
  const [busy, setBusy] = useState(false);

  async function pick() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.onchange = async () => {
      const files = Array.from(input.files ?? []);
      if (!files.length) return;
      setBusy(true);
      try {
        for (const f of files) {
          if (f.size > 8 * 1024 * 1024) {
            toast.error(`${f.name} > 8MB, skipped`);
            continue;
          }
          const url = await upload(f, "salon-media");
          await add({ data: { url } });
        }
        toast.success("Uploaded");
        onChanged();
      } catch (e: any) {
        toast.error(e?.message ?? "Upload failed");
      } finally {
        setBusy(false);
      }
    };
    input.click();
  }

  async function move(idx: number, dir: -1 | 1) {
    const next = idx + dir;
    if (next < 0 || next >= photos.length) return;
    const order = photos.map((p) => p.id);
    [order[idx], order[next]] = [order[next], order[idx]];
    await reorder({ data: { order } });
    onChanged();
  }

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Gallery ({photos.length})</h3>
        <Button size="sm" onClick={pick} disabled={busy}>
          {busy ? <Loader2 className="me-2 size-4 animate-spin" /> : <Plus className="me-2 size-4" />}
          Add photos
        </Button>
      </div>
      {photos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-hairline p-8 text-center text-sm text-muted-foreground">
          No photos yet. Add at least one to show on your public salon page.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((p, i) => (
            <div key={p.id} className="group relative aspect-square overflow-hidden rounded-xl border border-hairline">
              <img src={p.url} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/60 p-1 opacity-0 transition group-hover:opacity-100">
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="size-7 text-white" onClick={() => move(i, -1)} disabled={i === 0}>↑</Button>
                  <Button size="icon" variant="ghost" className="size-7 text-white" onClick={() => move(i, 1)} disabled={i === photos.length - 1}>↓</Button>
                </div>
                <Button size="icon" variant="ghost" className="size-7 text-white" onClick={async () => { await del({ data: { id: p.id } }); onChanged(); }}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ---------------- Location ----------------
function LocationSection({ shop, onSaved }: { shop: any; onSaved: () => void }) {
  const [form, setForm] = useState(() => ({
    country: shop.country ?? "SA",
    city: shop.city ?? "",
    district: shop.district ?? "",
    address: shop.address ?? "",
    full_address: shop.full_address ?? "",
    google_maps_url: shop.google_maps_url ?? "",
    lat: shop.lat ?? null,
    lng: shop.lng ?? null,
  }));
  const m = useUpdate(onSaved);
  return (
    <Card className="space-y-5 p-5">
      <Pair>
        <Field label="Country" value={form.country ?? ""} onChange={(v) => setForm({ ...form, country: v })} />
        <Field label="City" required value={form.city ?? ""} onChange={(v) => setForm({ ...form, city: v })} />
      </Pair>
      <Pair>
        <Field label="District" value={form.district ?? ""} onChange={(v) => setForm({ ...form, district: v })} />
        <Field label="Short address" value={form.address ?? ""} onChange={(v) => setForm({ ...form, address: v })} />
      </Pair>
      <TextArea label="Full address" value={form.full_address ?? ""} onChange={(v) => setForm({ ...form, full_address: v })} />
      <Field label="Google Maps URL" type="url" value={form.google_maps_url ?? ""} onChange={(v) => setForm({ ...form, google_maps_url: v })} />
      <Pair>
        <Field label="Latitude" type="number" value={form.lat ?? ""} onChange={(v) => setForm({ ...form, lat: v ? Number(v) : null })} />
        <Field label="Longitude" type="number" value={form.lng ?? ""} onChange={(v) => setForm({ ...form, lng: v ? Number(v) : null })} />
      </Pair>
      <div className="flex justify-end">
        <Button onClick={() => m.mutate(form)} disabled={m.isPending}>
          {m.isPending ? <Loader2 className="me-2 size-4 animate-spin" /> : <Save className="me-2 size-4" />}
          Save location
        </Button>
      </div>
    </Card>
  );
}

// ---------------- Hours ----------------
function HoursSection({ hours, onSaved }: { hours: any[]; onSaved: () => void }) {
  const initial = Array.from({ length: 7 }, (_, i) => {
    const row = hours.find((h) => h.day_of_week === i);
    return {
      day_of_week: i,
      opens_at: row?.opens_at?.slice(0, 5) ?? "09:00",
      closes_at: row?.closes_at?.slice(0, 5) ?? "22:00",
      closed: !row,
    };
  });
  const [rows, setRows] = useState(initial);
  const fn = useServerFn(updateShopHours);
  const m = useMutation({
    mutationFn: () => fn({ data: { hours: rows } }),
    onSuccess: () => { toast.success("Hours saved"); onSaved(); },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });
  return (
    <Card className="space-y-3 p-5">
      {rows.map((r, idx) => (
        <div key={r.day_of_week} className="grid grid-cols-[100px_1fr_1fr_auto] items-center gap-3">
          <div className="text-sm font-medium">{DAYS[r.day_of_week]}</div>
          <Input type="time" value={r.opens_at} disabled={r.closed}
            onChange={(e) => { const c = [...rows]; c[idx] = { ...c[idx], opens_at: e.target.value }; setRows(c); }} />
          <Input type="time" value={r.closes_at} disabled={r.closed}
            onChange={(e) => { const c = [...rows]; c[idx] = { ...c[idx], closes_at: e.target.value }; setRows(c); }} />
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={r.closed} onCheckedChange={(v) => { const c = [...rows]; c[idx] = { ...c[idx], closed: v }; setRows(c); }} />
            Closed
          </label>
        </div>
      ))}
      <div className="flex justify-end pt-2">
        <Button onClick={() => m.mutate()} disabled={m.isPending}>
          {m.isPending ? <Loader2 className="me-2 size-4 animate-spin" /> : <Clock className="me-2 size-4" />}
          Save hours
        </Button>
      </div>
    </Card>
  );
}

// ---------------- Holidays ----------------
function HolidaysSection({ holidays, onChanged }: { holidays: any[]; onChanged: () => void }) {
  const upsert = useServerFn(upsertHoliday);
  const del = useServerFn(deleteHoliday);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<any>({
    starts_on: new Date().toISOString().slice(0, 10),
    ends_on: new Date().toISOString().slice(0, 10),
    kind: "holiday",
    reason: "",
  });
  async function save() {
    try {
      await upsert({ data: form });
      toast.success("Closure saved");
      setAdding(false);
      onChanged();
    } catch (e: any) { toast.error(e?.message ?? "Save failed"); }
  }
  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Closures ({holidays.length})</h3>
        <Button size="sm" onClick={() => setAdding(!adding)}>
          <Plus className="me-2 size-4" />Add closure
        </Button>
      </div>
      {adding && (
        <div className="space-y-3 rounded-xl border border-hairline bg-surface p-4">
          <Pair>
            <Field label="From" type="date" value={form.starts_on} onChange={(v) => setForm({ ...form, starts_on: v })} />
            <Field label="To" type="date" value={form.ends_on} onChange={(v) => setForm({ ...form, ends_on: v })} />
          </Pair>
          <div>
            <Label>Type</Label>
            <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="holiday">Holiday</SelectItem>
                <SelectItem value="vacation">Vacation</SelectItem>
                <SelectItem value="temporary">Temporary closure</SelectItem>
                <SelectItem value="emergency">Emergency closure</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Field label="Reason (optional)" value={form.reason} onChange={(v) => setForm({ ...form, reason: v })} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </div>
        </div>
      )}
      {holidays.length === 0 ? (
        <p className="rounded-xl border border-dashed border-hairline p-6 text-center text-sm text-muted-foreground">No closures defined.</p>
      ) : (
        <ul className="divide-y divide-hairline rounded-xl border border-hairline">
          {holidays.map((h) => (
            <li key={h.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <div className="font-medium">{h.starts_on} → {h.ends_on}</div>
                <div className="text-xs text-muted-foreground capitalize">{h.kind}{h.reason ? ` · ${h.reason}` : ""}</div>
              </div>
              <Button size="icon" variant="ghost" onClick={async () => { await del({ data: { id: h.id } }); onChanged(); }}>
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ---------------- Features ----------------
function FeaturesSection({ shop, onSaved }: { shop: any; onSaved: () => void }) {
  const m = useUpdate(onSaved);
  const items: { key: string; label: string }[] = [
    { key: "booking_enabled", label: "Accept bookings" },
    { key: "accept_reviews", label: "Accept reviews" },
    { key: "walkin_enabled", label: "Walk-ins enabled" },
    { key: "display_phone", label: "Display phone number" },
    { key: "display_whatsapp", label: "Display WhatsApp" },
    { key: "display_address", label: "Display address" },
    { key: "display_gallery", label: "Display gallery" },
    { key: "display_team", label: "Display team" },
    { key: "display_services", label: "Display services" },
  ];
  return (
    <Card className="space-y-3 p-5">
      {items.map((it) => (
        <div key={it.key} className="flex items-center justify-between border-b border-hairline py-2 last:border-b-0">
          <span className="text-sm">{it.label}</span>
          <Switch
            checked={!!shop[it.key]}
            onCheckedChange={(v) => m.mutate({ [it.key]: v })}
            disabled={m.isPending}
          />
        </div>
      ))}
    </Card>
  );
}

// ---------------- Visibility ----------------
function VisibilitySection({ shop, onSaved }: { shop: any; onSaved: () => void }) {
  const m = useUpdate(onSaved);
  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/salons/${shop.slug}` : "";
  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">Published</div>
          <p className="text-xs text-muted-foreground">When off, customers cannot find your salon.</p>
        </div>
        <Switch checked={shop.published} onCheckedChange={(v) => m.mutate({ published: v })} />
      </div>
      <div className="flex items-center justify-between border-t border-hairline pt-4">
        <div>
          <div className="font-medium">Pause bookings</div>
          <p className="text-xs text-muted-foreground">Salon stays visible, but customers cannot book.</p>
        </div>
        <Switch checked={shop.paused_bookings} onCheckedChange={(v) => m.mutate({ paused_bookings: v })} />
      </div>
      <div className="border-t border-hairline pt-4">
        <Label>Public link</Label>
        <div className="mt-1 flex gap-2">
          <Input readOnly value={publicUrl} />
          <Button variant="outline" onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success("Copied"); }}>
            <Copy className="size-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ---------------- Danger zone ----------------
function DangerZone({ shop, onChanged }: { shop: any; onChanged: () => void }) {
  const navigate = useNavigate();
  const arc = useServerFn(archiveSalon);
  const unarc = useServerFn(unarchiveSalon);
  const req = useServerFn(requestSalonDeletion);
  return (
    <Card className="space-y-4 border-destructive/40 p-5">
      <div className="flex items-center gap-2 text-destructive">
        <AlertTriangle className="size-5" />
        <h3 className="font-medium">Danger zone</h3>
      </div>
      <div className="grid gap-3 text-sm">
        {shop.archived_at ? (
          <ActionRow
            title="Restore salon"
            desc="Re-publishes the salon and removes the archived state."
            buttonLabel="Restore"
            onConfirm={async () => { await unarc(); toast.success("Restored"); onChanged(); }}
          />
        ) : (
          <ActionRow
            title="Archive salon"
            desc="Hides your salon from customers but keeps all data intact."
            buttonLabel="Archive"
            onConfirm={async () => { await arc(); toast.success("Archived"); onChanged(); }}
          />
        )}
        {shop.deletion_requested_at ? (
          <p className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
            Deletion requested on {new Date(shop.deletion_requested_at).toLocaleDateString()}. Waiting on Super Admin approval.
          </p>
        ) : (
          <ActionRow
            title="Request salon deletion"
            desc="Sends a deletion request to the platform administrator. Cannot be undone once approved."
            buttonLabel="Request deletion"
            destructive
            onConfirm={async () => { await req(); toast.success("Request sent"); onChanged(); }}
          />
        )}
      </div>
    </Card>
  );
}

function ActionRow({ title, desc, buttonLabel, onConfirm, destructive }: any) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-hairline p-3">
      <div>
        <div className="font-medium">{title}</div>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant={destructive ? "destructive" : "outline"} size="sm">{buttonLabel}</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}?</AlertDialogTitle>
            <AlertDialogDescription>{desc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirm}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------- helpers ----------------
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
function Pair({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}
type FieldProps = {
  label: string;
  required?: boolean;
  type?: string;
  value: string | number | null | undefined;
  onChange: (v: string) => void;
};
function Field({ label, required, type = "text", value, onChange }: FieldProps) {
  return (
    <div>
      <Label>{label}{required && <span className="text-destructive"> *</span>}</Label>
      <Input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
function TextArea({ label, value, onChange }: { label: string; value: string | null | undefined; onChange: (v: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} rows={3} />
    </div>
  );
}
