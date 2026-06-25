import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Loader2, Plus, Search, Trash2, Copy, Edit, MoreHorizontal, Star,
  Image as ImageIcon, X, Tag, Save, Upload,
} from "lucide-react";
import {
  getServicesPage, upsertService, deleteService, duplicateService, bulkUpdateServices,
  upsertCategory, deleteCategory,
} from "@/lib/owner-services.functions";
import { useOwnerMediaUpload } from "@/lib/use-owner-media-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/owner/services")({
  component: ServicesPage,
});

type Svc = {
  id: string;
  name_en: string; name_ar: string;
  description_en: string | null; description_ar: string | null;
  category_id: string | null; category: string | null;
  price_sar: number; duration_min: number;
  prep_minutes: number; cleanup_minutes: number; buffer_minutes: number;
  status: "active" | "hidden" | "unavailable" | "archived";
  image_url: string | null; color: string | null;
  display_order: number;
  featured: boolean; popular: boolean; recommended: boolean;
  barber_ids: string[];
  bookings_this_month: number;
};
type Cat = { id: string; name_en: string; name_ar: string; sort_order: number };
type Barber = { id: string; display_name_en: string; display_name_ar: string; photo_url: string | null; status: string };

function ServicesPage() {
  const qc = useQueryClient();
  const fetchPage = useServerFn(getServicesPage);
  const { data, isLoading, error } = useQuery({
    queryKey: ["owner", "services"],
    queryFn: () => fetchPage(),
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Svc | "new" | null>(null);
  const [catManagerOpen, setCatManagerOpen] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["owner", "services"] });

  const services: Svc[] = (data?.services ?? []) as Svc[];
  const categories: Cat[] = (data?.categories ?? []) as Cat[];
  const barbers: Barber[] = (data?.barbers ?? []) as Barber[];

  const filtered = useMemo(() => {
    return services.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (catFilter !== "all" && s.category_id !== catFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!s.name_en.toLowerCase().includes(q) && !s.name_ar.includes(search)) return false;
      }
      return true;
    });
  }, [services, search, statusFilter, catFilter]);

  if (isLoading) return <div className="grid place-items-center py-20"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  if (error) return <div className="rounded-2xl border border-hairline bg-surface p-6 text-sm text-muted-foreground">Unable to load services: {(error as any)?.message}</div>;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Services</h1>
          <p className="text-sm text-muted-foreground">{services.length} total · {services.filter((s) => s.status === "active").length} active</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCatManagerOpen(true)}>
            <Tag className="me-2 size-4" />Categories
          </Button>
          <Button onClick={() => setEditing("new")}>
            <Plus className="me-2 size-4" />New service
          </Button>
        </div>
      </header>

      <Card className="flex flex-wrap items-center gap-2 p-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search services…" value={search} onChange={(e) => setSearch(e.target.value)} className="ps-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="hidden">Hidden</SelectItem>
            <SelectItem value="unavailable">Unavailable</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name_en}</SelectItem>)}
          </SelectContent>
        </Select>
      </Card>

      {selected.size > 0 && (
        <BulkBar
          count={selected.size}
          ids={Array.from(selected)}
          categories={categories}
          barbers={barbers}
          onDone={() => { setSelected(new Set()); invalidate(); }}
        />
      )}

      {filtered.length === 0 ? (
        <Card className="grid place-items-center p-12 text-center text-sm text-muted-foreground">
          No services match your filters. <Button variant="link" onClick={() => setEditing("new")}>Create your first service</Button>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-hairline bg-surface text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="w-10 p-3">
                    <Checkbox
                      checked={selected.size > 0 && selected.size === filtered.length}
                      onCheckedChange={(v) => {
                        if (v) setSelected(new Set(filtered.map((s) => s.id)));
                        else setSelected(new Set());
                      }}
                    />
                  </th>
                  <th className="p-3 text-start">Service</th>
                  <th className="p-3 text-start">Category</th>
                  <th className="p-3 text-end">Price</th>
                  <th className="p-3 text-end">Duration</th>
                  <th className="p-3 text-center">Barbers</th>
                  <th className="p-3 text-center">This month</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b border-hairline last:border-b-0 hover:bg-surface/50">
                    <td className="p-3">
                      <Checkbox
                        checked={selected.has(s.id)}
                        onCheckedChange={(v) => {
                          const next = new Set(selected);
                          if (v) next.add(s.id); else next.delete(s.id);
                          setSelected(next);
                        }}
                      />
                    </td>
                    <td className="p-3">
                      <button className="flex items-center gap-3 text-start" onClick={() => setEditing(s)}>
                        <div className="size-10 overflow-hidden rounded-lg bg-surface">
                          {s.image_url
                            ? <img src={s.image_url} alt="" className="h-full w-full object-cover" />
                            : <div className="grid h-full w-full place-items-center text-muted-foreground"><ImageIcon className="size-4" /></div>}
                        </div>
                        <div>
                          <div className="font-medium">{s.name_en}</div>
                          <div className="text-xs text-muted-foreground">{s.name_ar}</div>
                          <div className="mt-0.5 flex gap-1">
                            {s.featured && <Badge variant="secondary" className="h-4 px-1 text-[10px]">Featured</Badge>}
                            {s.popular && <Badge variant="secondary" className="h-4 px-1 text-[10px]">Popular</Badge>}
                            {s.recommended && <Badge variant="secondary" className="h-4 px-1 text-[10px]">Recommended</Badge>}
                          </div>
                        </div>
                      </button>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {categories.find((c) => c.id === s.category_id)?.name_en ?? s.category ?? "—"}
                    </td>
                    <td className="p-3 text-end font-medium">{Number(s.price_sar)} SAR</td>
                    <td className="p-3 text-end">{s.duration_min} min</td>
                    <td className="p-3 text-center text-xs">{s.barber_ids.length}/{barbers.length}</td>
                    <td className="p-3 text-center">{s.bookings_this_month}</td>
                    <td className="p-3 text-center">
                      <Badge variant={s.status === "active" ? "default" : s.status === "archived" ? "outline" : "secondary"} className="capitalize">
                        {s.status}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <RowActions svc={s} onChanged={invalidate} onEdit={() => setEditing(s)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <ServiceEditor
        open={editing !== null}
        service={editing === "new" ? null : editing}
        categories={categories}
        barbers={barbers}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); invalidate(); }}
      />

      <CategoryManager
        open={catManagerOpen}
        categories={categories}
        onClose={() => setCatManagerOpen(false)}
        onChanged={invalidate}
      />
    </div>
  );
}

function RowActions({ svc, onChanged, onEdit }: { svc: Svc; onChanged: () => void; onEdit: () => void }) {
  const dup = useServerFn(duplicateService);
  const del = useServerFn(deleteService);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon"><MoreHorizontal className="size-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}><Edit className="me-2 size-4" />Edit</DropdownMenuItem>
        <DropdownMenuItem onClick={async () => { await dup({ data: { id: svc.id } }); toast.success("Duplicated"); onChanged(); }}>
          <Copy className="me-2 size-4" />Duplicate
        </DropdownMenuItem>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
              <Trash2 className="me-2 size-4" />Archive
            </DropdownMenuItem>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Archive "{svc.name_en}"?</AlertDialogTitle>
              <AlertDialogDescription>
                The service will be hidden from customers but past bookings and analytics are preserved.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={async () => { await del({ data: { id: svc.id } }); toast.success("Archived"); onChanged(); }}>Archive</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function BulkBar({ count, ids, categories, barbers, onDone }: { count: number; ids: string[]; categories: Cat[]; barbers: Barber[]; onDone: () => void }) {
  const fn = useServerFn(bulkUpdateServices);
  async function run(payload: any) {
    try {
      await fn({ data: { ids, ...payload } });
      toast.success("Updated");
      onDone();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }
  return (
    <Card className="flex flex-wrap items-center gap-2 border-gold/40 p-3">
      <span className="text-sm font-medium">{count} selected</span>
      <Button size="sm" variant="outline" onClick={() => run({ action: "activate" })}>Activate</Button>
      <Button size="sm" variant="outline" onClick={() => run({ action: "hide" })}>Hide</Button>
      <Button size="sm" variant="outline" onClick={() => run({ action: "archive" })}>Archive</Button>
      <Select onValueChange={(v) => run({ action: "category", category_id: v === "_none" ? null : v })}>
        <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="Set category…" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="_none">No category</SelectItem>
          {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name_en}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select onValueChange={(v) => run({ action: "barber", barber_id: v })}>
        <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="Assign barber…" /></SelectTrigger>
        <SelectContent>
          {barbers.map((b) => <SelectItem key={b.id} value={b.id}>{b.display_name_en}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button size="sm" variant="ghost" onClick={onDone}><X className="size-4" /></Button>
    </Card>
  );
}

function ServiceEditor({ open, service, categories, barbers, onClose, onSaved }: { open: boolean; service: Svc | null; categories: Cat[]; barbers: Barber[]; onClose: () => void; onSaved: () => void }) {
  const upload = useOwnerMediaUpload();
  const fn = useServerFn(upsertService);
  const empty: Svc = {
    id: "", name_en: "", name_ar: "",
    description_en: "", description_ar: "",
    category_id: null, category: null,
    price_sar: 50, duration_min: 30,
    prep_minutes: 0, cleanup_minutes: 0, buffer_minutes: 0,
    status: "active", image_url: null, color: null,
    display_order: 0, featured: false, popular: false, recommended: false,
    barber_ids: [], bookings_this_month: 0,
  };
  const [form, setForm] = useState<Svc>(empty);
  const [uploading, setUploading] = useState(false);

  // reset on open
  useState(() => undefined);
  if (open && form.id !== (service?.id ?? "") && (service ? form.name_en !== service.name_en : form.name_en !== "")) {
    // initial sync once per opening; safe pattern
  }

  // re-init when target changes
  useMemo(() => {
    if (open) setForm(service ? { ...service } : empty);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, service?.id]);

  async function pickImage() {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*";
    input.onchange = async () => {
      const f = input.files?.[0]; if (!f) return;
      if (f.size > 8 * 1024 * 1024) { toast.error("Max 8MB"); return; }
      setUploading(true);
      try {
        const url = await upload(f, "service-media");
        setForm((s) => ({ ...s, image_url: url }));
      } catch (e: any) { toast.error(e?.message ?? "Upload failed"); }
      finally { setUploading(false); }
    };
    input.click();
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form };
      if (!payload.id) delete payload.id;
      delete payload.bookings_this_month;
      return fn({ data: payload });
    },
    onSuccess: () => { toast.success("Saved"); onSaved(); },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{service ? "Edit service" : "New service"}</SheetTitle>
        </SheetHeader>
        <div className="space-y-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Name (English) *</Label><Input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} /></div>
            <div><Label>Name (Arabic) *</Label><Input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Description (English)</Label><Textarea value={form.description_en ?? ""} onChange={(e) => setForm({ ...form, description_en: e.target.value })} rows={3} /></div>
            <div><Label>Description (Arabic)</Label><Textarea value={form.description_ar ?? ""} onChange={(e) => setForm({ ...form, description_ar: e.target.value })} rows={3} /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Category</Label>
              <Select value={form.category_id ?? "_none"} onValueChange={(v) => setForm({ ...form, category_id: v === "_none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">No category</SelectItem>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name_en}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Price (SAR) *</Label><Input type="number" min={0} value={form.price_sar} onChange={(e) => setForm({ ...form, price_sar: Number(e.target.value) })} /></div>
            <div><Label>Duration (min) *</Label><Input type="number" min={1} value={form.duration_min} onChange={(e) => setForm({ ...form, duration_min: Number(e.target.value) })} /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div><Label>Prep (min)</Label><Input type="number" min={0} value={form.prep_minutes} onChange={(e) => setForm({ ...form, prep_minutes: Number(e.target.value) })} /></div>
            <div><Label>Cleanup (min)</Label><Input type="number" min={0} value={form.cleanup_minutes} onChange={(e) => setForm({ ...form, cleanup_minutes: Number(e.target.value) })} /></div>
            <div><Label>Buffer (min)</Label><Input type="number" min={0} value={form.buffer_minutes} onChange={(e) => setForm({ ...form, buffer_minutes: Number(e.target.value) })} /></div>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="hidden">Hidden</SelectItem>
                <SelectItem value="unavailable">Unavailable</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Image</Label>
            <div className="mt-1 flex items-center gap-3">
              <div className="relative size-20 overflow-hidden rounded-lg border border-hairline bg-surface">
                {form.image_url
                  ? <img src={form.image_url} alt="" className="h-full w-full object-cover" />
                  : <div className="grid h-full w-full place-items-center text-muted-foreground"><ImageIcon className="size-5" /></div>}
                {uploading && <div className="absolute inset-0 grid place-items-center bg-black/50"><Loader2 className="size-4 animate-spin text-white" /></div>}
              </div>
              <Button variant="outline" size="sm" onClick={pickImage} disabled={uploading}>
                <Upload className="me-2 size-4" />{form.image_url ? "Replace" : "Upload"}
              </Button>
              {form.image_url && <Button variant="ghost" size="sm" onClick={() => setForm({ ...form, image_url: null })}><Trash2 className="size-4" /></Button>}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <FlagToggle label="Featured" value={form.featured} onChange={(v) => setForm({ ...form, featured: v })} />
            <FlagToggle label="Popular" value={form.popular} onChange={(v) => setForm({ ...form, popular: v })} />
            <FlagToggle label="Recommended" value={form.recommended} onChange={(v) => setForm({ ...form, recommended: v })} />
          </div>
          <div>
            <Label>Assigned barbers ({form.barber_ids.length}/{barbers.length})</Label>
            <div className="mt-2 space-y-2 rounded-xl border border-hairline p-3 max-h-48 overflow-y-auto">
              {barbers.length === 0 && <p className="text-xs text-muted-foreground">No barbers yet. Invite barbers first.</p>}
              {barbers.map((b) => {
                const on = form.barber_ids.includes(b.id);
                return (
                  <label key={b.id} className="flex cursor-pointer items-center justify-between text-sm">
                    <span>{b.display_name_en} <span className="text-xs text-muted-foreground">{b.display_name_ar}</span></span>
                    <Switch checked={on} onCheckedChange={(v) => {
                      const next = new Set(form.barber_ids);
                      if (v) next.add(b.id); else next.delete(b.id);
                      setForm({ ...form, barber_ids: Array.from(next) });
                    }} />
                  </label>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-hairline pt-4">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name_en || !form.name_ar}>
              {save.isPending ? <Loader2 className="me-2 size-4 animate-spin" /> : <Save className="me-2 size-4" />}
              Save
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function FlagToggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={cn(
        "rounded-xl border px-3 py-2 text-xs font-medium transition",
        value ? "border-gold bg-gold/10 text-gold" : "border-hairline text-muted-foreground hover:bg-surface",
      )}
    >
      <Star className={cn("inline-block size-3", value ? "fill-current" : "")} /> {label}
    </button>
  );
}

function CategoryManager({ open, categories, onClose, onChanged }: { open: boolean; categories: Cat[]; onClose: () => void; onChanged: () => void }) {
  const upsert = useServerFn(upsertCategory);
  const del = useServerFn(deleteCategory);
  const [name_en, setNameEn] = useState("");
  const [name_ar, setNameAr] = useState("");

  async function add() {
    if (!name_en || !name_ar) return;
    try {
      await upsert({ data: { name_en, name_ar, sort_order: categories.length } });
      setNameEn(""); setNameAr("");
      onChanged();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader><SheetTitle>Service categories</SheetTitle></SheetHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2 rounded-xl border border-hairline p-3">
            <div className="text-xs font-medium text-muted-foreground">New category</div>
            <Input placeholder="Name (English)" value={name_en} onChange={(e) => setNameEn(e.target.value)} />
            <Input placeholder="Name (Arabic)" value={name_ar} onChange={(e) => setNameAr(e.target.value)} dir="rtl" />
            <Button size="sm" onClick={add} disabled={!name_en || !name_ar} className="w-full">
              <Plus className="me-2 size-4" />Add
            </Button>
          </div>
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">No categories yet.</p>
          ) : (
            <ul className="divide-y divide-hairline rounded-xl border border-hairline">
              {categories.map((c) => (
                <CategoryRow key={c.id} cat={c} onChanged={onChanged} />
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CategoryRow({ cat, onChanged }: { cat: Cat; onChanged: () => void }) {
  const upsert = useServerFn(upsertCategory);
  const del = useServerFn(deleteCategory);
  const [name_en, setNameEn] = useState(cat.name_en);
  const [name_ar, setNameAr] = useState(cat.name_ar);
  const [editing, setEditing] = useState(false);
  return (
    <li className="flex items-center gap-2 px-3 py-2 text-sm">
      {editing ? (
        <>
          <Input value={name_en} onChange={(e) => setNameEn(e.target.value)} className="h-8" />
          <Input value={name_ar} onChange={(e) => setNameAr(e.target.value)} className="h-8" dir="rtl" />
          <Button size="sm" onClick={async () => { await upsert({ data: { id: cat.id, name_en, name_ar } }); setEditing(false); onChanged(); }}>Save</Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
        </>
      ) : (
        <>
          <div className="flex-1">
            <div className="font-medium">{cat.name_en}</div>
            <div className="text-xs text-muted-foreground">{cat.name_ar}</div>
          </div>
          <Button size="icon" variant="ghost" onClick={() => setEditing(true)}><Edit className="size-4" /></Button>
          <Button size="icon" variant="ghost" onClick={async () => { await del({ data: { id: cat.id } }); onChanged(); }}><Trash2 className="size-4" /></Button>
        </>
      )}
    </li>
  );
}
