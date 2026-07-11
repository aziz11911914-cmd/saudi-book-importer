import { useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "react-i18next";

/* ----------------------------- shared shell ---------------------------- */

function Shell({
  open,
  onOpenChange,
  title,
  children,
  onSave,
  saving,
  saveLabel,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  children: ReactNode;
  onSave: () => void | Promise<void>;
  saving: boolean;
  saveLabel?: string;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={(v) => (!saving ? onOpenChange(v) : null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">{children}</div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("owner.editors.cancel")}
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving && <Loader2 className="me-2 size-4 animate-spin" />}
            {saveLabel ?? t("owner.editors.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------ dialogs -------------------------------- */

export function TextPairDialog({
  open, onOpenChange, title, labelEn, labelAr, valueEn, valueAr, multiline, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  labelEn: string;
  labelAr: string;
  valueEn: string;
  valueAr: string;
  multiline?: boolean;
  onSave: (v: { en: string; ar: string }) => Promise<void>;
}) {
  const [en, setEn] = useState(valueEn);
  const [ar, setAr] = useState(valueAr);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setEn(valueEn); setAr(valueAr); } }, [open, valueEn, valueAr]);
  const Field = multiline ? Textarea : Input;
  return (
    <Shell open={open} onOpenChange={onOpenChange} title={title} saving={saving}
      onSave={async () => { setSaving(true); try { await onSave({ en, ar }); onOpenChange(false); } finally { setSaving(false); } }}>
      <div className="space-y-2"><Label>{labelEn}</Label><Field value={en} onChange={(e: any) => setEn(e.target.value)} rows={4} /></div>
      <div className="space-y-2"><Label>{labelAr}</Label><Field dir="rtl" value={ar} onChange={(e: any) => setAr(e.target.value)} rows={4} /></div>
    </Shell>
  );
}

export function TextDialog({
  open, onOpenChange, title, label, value, onSave, multiline,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  label: string;
  value: string;
  multiline?: boolean;
  onSave: (v: string) => Promise<void>;
}) {
  const [v, setV] = useState(value);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setV(value); }, [open, value]);
  const Field = multiline ? Textarea : Input;
  return (
    <Shell open={open} onOpenChange={onOpenChange} title={title} saving={saving}
      onSave={async () => { setSaving(true); try { await onSave(v); onOpenChange(false); } finally { setSaving(false); } }}>
      <div className="space-y-2"><Label>{label}</Label><Field value={v} onChange={(e: any) => setV(e.target.value)} rows={4} /></div>
    </Shell>
  );
}

export function LocationDialog({
  open, onOpenChange, address, lat, lng, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  address: string;
  lat: number | null;
  lng: number | null;
  onSave: (v: { address: string; lat: number | null; lng: number | null }) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [a, setA] = useState(address);
  const [la, setLa] = useState(lat != null ? String(lat) : "");
  const [ln, setLn] = useState(lng != null ? String(lng) : "");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) { setA(address); setLa(lat != null ? String(lat) : ""); setLn(lng != null ? String(lng) : ""); }
  }, [open, address, lat, lng]);
  return (
    <Shell open={open} onOpenChange={onOpenChange} title={t("owner.editors.location")} saving={saving}
      onSave={async () => {
        const latN = la.trim() === "" ? null : parseFloat(la);
        const lngN = ln.trim() === "" ? null : parseFloat(ln);
        if ((la && Number.isNaN(latN!)) || (ln && Number.isNaN(lngN!))) return;
        setSaving(true);
        try { await onSave({ address: a, lat: latN, lng: lngN }); onOpenChange(false); }
        finally { setSaving(false); }
      }}>
      <div className="space-y-2"><Label>{t("owner.editors.address")}</Label><Input value={a} onChange={(e) => setA(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2"><Label>{t("owner.editors.latitude")}</Label><Input inputMode="decimal" value={la} onChange={(e) => setLa(e.target.value)} /></div>
        <div className="space-y-2"><Label>{t("owner.editors.longitude")}</Label><Input inputMode="decimal" value={ln} onChange={(e) => setLn(e.target.value)} /></div>
      </div>
      <p className="text-xs text-muted-foreground">{t("owner.editors.mapsTip")}</p>
    </Shell>
  );
}

/* ------------------------------ hours ---------------------------------- */

export type HoursRow = { day_of_week: number; opens_at: string; closes_at: string; closed: boolean };

export function HoursDialog({
  open, onOpenChange, hours, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  hours: { day_of_week: number; opens_at: string; closes_at: string }[];
  onSave: (v: HoursRow[]) => Promise<void>;
}) {
  const { t } = useTranslation();
  const build = (): HoursRow[] =>
    Array.from({ length: 7 }).map((_, i) => {
      const h = hours.find((x) => x.day_of_week === i);
      return {
        day_of_week: i,
        opens_at: h?.opens_at?.slice(0, 5) ?? "09:00",
        closes_at: h?.closes_at?.slice(0, 5) ?? "21:00",
        closed: !h,
      };
    });
  const [rows, setRows] = useState<HoursRow[]>(build());
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setRows(build()); /* eslint-disable-next-line */ }, [open, hours]);
  const days = t("days.long", { returnObjects: true }) as string[];
  return (
    <Shell open={open} onOpenChange={onOpenChange} title={t("owner.editors.workingHours")} saving={saving}
      onSave={async () => { setSaving(true); try { await onSave(rows); onOpenChange(false); } finally { setSaving(false); } }}>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg border border-hairline p-2">
            <span className="w-20 text-sm">{days[i]}</span>
            <Switch checked={!r.closed} onCheckedChange={(v) => setRows((rr) => rr.map((x, j) => j === i ? { ...x, closed: !v } : x))} />
            <Input type="time" disabled={r.closed} value={r.opens_at}
              onChange={(e) => setRows((rr) => rr.map((x, j) => j === i ? { ...x, opens_at: e.target.value } : x))}
              className="h-8 flex-1" />
            <span className="text-muted-foreground">—</span>
            <Input type="time" disabled={r.closed} value={r.closes_at}
              onChange={(e) => setRows((rr) => rr.map((x, j) => j === i ? { ...x, closes_at: e.target.value } : x))}
              className="h-8 flex-1" />
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* ------------------------------ service -------------------------------- */

export type ServiceForm = {
  id?: string;
  name_en: string;
  name_ar: string;
  price_sar: number;
  duration_min: number;
};

export function ServiceDialog({
  open, onOpenChange, value, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  value: ServiceForm | null;
  onSave: (v: ServiceForm) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [f, setF] = useState<ServiceForm>({ name_en: "", name_ar: "", price_sar: 0, duration_min: 30 });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) setF(value ?? { name_en: "", name_ar: "", price_sar: 0, duration_min: 30 });
  }, [open, value]);
  return (
    <Shell open={open} onOpenChange={onOpenChange}
      title={value?.id ? t("owner.editors.serviceEdit") : t("owner.editors.serviceAdd")}
      saving={saving}
      onSave={async () => { setSaving(true); try { await onSave(f); onOpenChange(false); } finally { setSaving(false); } }}>
      <div className="space-y-2"><Label>{t("owner.editors.nameEn")}</Label><Input value={f.name_en} onChange={(e) => setF({ ...f, name_en: e.target.value })} /></div>
      <div className="space-y-2"><Label>{t("owner.editors.nameAr")}</Label><Input dir="rtl" value={f.name_ar} onChange={(e) => setF({ ...f, name_ar: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2"><Label>{t("owner.editors.servicePrice")}</Label><Input type="number" min={0} value={f.price_sar}
          onChange={(e) => setF({ ...f, price_sar: Number(e.target.value) })} /></div>
        <div className="space-y-2"><Label>{t("owner.editors.serviceDuration")}</Label><Input type="number" min={1} value={f.duration_min}
          onChange={(e) => setF({ ...f, duration_min: Number(e.target.value) })} /></div>
      </div>
    </Shell>
  );
}

/* ------------------------------ barber --------------------------------- */

export type BarberForm = {
  id?: string;
  display_name_en: string;
  display_name_ar: string;
  title_en: string;
  title_ar: string;
  photo_url: string | null;
};

export function BarberDialog({
  open, onOpenChange, value, onSave, onPickPhoto, uploading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  value: BarberForm | null;
  onSave: (v: BarberForm) => Promise<void>;
  onPickPhoto: () => Promise<string | null>;
  uploading?: boolean;
}) {
  const { t } = useTranslation();
  const [f, setF] = useState<BarberForm>({
    display_name_en: "", display_name_ar: "", title_en: "Barber", title_ar: "حلاق", photo_url: null,
  });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) setF(value ?? { display_name_en: "", display_name_ar: "", title_en: "Barber", title_ar: "حلاق", photo_url: null });
  }, [open, value]);
  return (
    <Shell open={open} onOpenChange={onOpenChange}
      title={value?.id ? t("owner.editors.barberEdit") : t("owner.editors.barberAdd")}
      saving={saving}
      onSave={async () => { setSaving(true); try { await onSave(f); onOpenChange(false); } finally { setSaving(false); } }}>
      <div className="flex items-center gap-3">
        <div className="size-16 overflow-hidden rounded-full border border-hairline bg-surface">
          {f.photo_url
            ? <img src={f.photo_url} alt="" className="h-full w-full object-cover" />
            : <div className="grid h-full w-full place-items-center text-xs text-muted-foreground">{t("owner.editors.noPhoto")}</div>}
        </div>
        <Button variant="outline" size="sm" disabled={uploading}
          onClick={async () => { const url = await onPickPhoto(); if (url) setF((x) => ({ ...x, photo_url: url })); }}>
          {uploading && <Loader2 className="me-2 size-4 animate-spin" />}
          {f.photo_url ? t("owner.editors.changePhoto") : t("owner.editors.uploadPhoto")}
        </Button>
      </div>
      <div className="space-y-2"><Label>{t("owner.editors.nameEn")}</Label><Input value={f.display_name_en} onChange={(e) => setF({ ...f, display_name_en: e.target.value })} /></div>
      <div className="space-y-2"><Label>{t("owner.editors.nameAr")}</Label><Input dir="rtl" value={f.display_name_ar} onChange={(e) => setF({ ...f, display_name_ar: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2"><Label>{t("owner.editors.titleEn")}</Label><Input value={f.title_en} onChange={(e) => setF({ ...f, title_en: e.target.value })} /></div>
        <div className="space-y-2"><Label>{t("owner.editors.titleAr")}</Label><Input dir="rtl" value={f.title_ar} onChange={(e) => setF({ ...f, title_ar: e.target.value })} /></div>
      </div>
    </Shell>
  );
}

/* --------------------------- confirm dialog ---------------------------- */

export function Confirm({
  open, onOpenChange, title, description, confirmLabel, onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={(v) => (!busy ? onOpenChange(v) : null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t("owner.editors.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={async (e) => {
              e.preventDefault();
              setBusy(true);
              try { await onConfirm(); onOpenChange(false); } finally { setBusy(false); }
            }}
            disabled={busy}
          >
            {busy && <Loader2 className="me-2 size-4 animate-spin" />}
            {confirmLabel ?? t("owner.editors.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
