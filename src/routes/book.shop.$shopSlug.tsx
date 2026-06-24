import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Shuffle,
  Star,
} from "lucide-react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import logoUrl from "@/assets/qassah-logo.png";
import { useLocale } from "@/lib/locale-provider";
import {
  fetchBarberAvailability,
  fetchShopBySlug,
} from "@/lib/queries";
import { formatPrice } from "@/lib/format";
import {
  computeSlots,
  formatDateLong,
  formatTime12,
  riyadhLocalToUtcISO,
  toRiyadhDateKey,
} from "@/lib/slots";
import { cn } from "@/lib/utils";
import { createBooking } from "@/lib/booking-store";

const searchSchema = z.object({
  step: fallback(
    z.enum(["service", "barber", "date", "time", "review"]),
    "service",
  ).default("service"),
  service: fallback(z.string().optional(), undefined),
  barber: fallback(z.string().optional(), undefined), // "any" or barber id
  date: fallback(z.string().optional(), undefined),
  time: fallback(z.string().optional(), undefined),
});

export const Route = createFileRoute("/book/shop/$shopSlug")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({ meta: [{ title: "Book — Qassah" }] }),
  component: ShopBookPage,
});

const STEPS = ["service", "barber", "date", "time", "review"] as const;
type Step = (typeof STEPS)[number];

function ShopBookPage() {
  const { shopSlug } = Route.useParams();
  const search = Route.useSearch();
  const router = useRouter();
  const navigate = useNavigate({ from: "/book/shop/$shopSlug" });
  const { t } = useTranslation();
  const { t: tt, lng, rtl } = useLocale();
  const ArrowBack = rtl ? ArrowRight : ArrowLeft;

  const [notes, setNotes] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const { data: shop } = useQuery({
    queryKey: ["shop", shopSlug],
    queryFn: () => fetchShopBySlug(shopSlug),
  });

  const service = useMemo(
    () => shop?.services.find((s) => s.id === search.service) ?? null,
    [shop, search.service],
  );

  const selectedBarber = useMemo(() => {
    if (!shop) return null;
    if (!search.barber || search.barber === "any") return null;
    return shop.barbers.find((b) => b.id === search.barber) ?? null;
  }, [shop, search.barber]);

  // For "any" mode pick the first barber for slot computation (each barber
  // has same availability in this demo); confirm assigns the first available.
  const slotBarberId = selectedBarber?.id ?? shop?.barbers[0]?.id ?? null;

  const { data: availability = [] } = useQuery({
    queryKey: ["availability", slotBarberId],
    queryFn: () => fetchBarberAvailability(slotBarberId!),
    enabled: !!slotBarberId,
  });

  const slots = useMemo(() => {
    if (!service || !search.date || !slotBarberId) return [];
    return computeSlots({
      dateISO: search.date,
      durationMin: service.duration_min,
      availability,
      barberId: slotBarberId,
    });
  }, [service, search.date, availability, slotBarberId]);

  const stepIdx = STEPS.indexOf(search.step as Step);

  function setStep(next: Step, extra: Partial<typeof search> = {}) {
    navigate({ search: (s: typeof search) => ({ ...s, ...extra, step: next }), params: { shopSlug } });
  }
  function pickService(id: string) { setStep("barber", { service: id, barber: undefined, date: undefined, time: undefined }); }
  function pickBarber(id: string) { setStep("date", { barber: id, date: undefined, time: undefined }); }
  function pickDate(d: string) { setStep("time", { date: d, time: undefined }); }
  function pickTime(hhmm: string) { setStep("review", { time: hhmm }); }

  function confirm() {
    if (!shop || !service || !search.date || !search.time) return;
    const barber = selectedBarber ?? shop.barbers[0];
    if (!barber) return;
    const startISO = riyadhLocalToUtcISO(search.date, search.time);
    const endISO = new Date(new Date(startISO).getTime() + service.duration_min * 60_000).toISOString();
    const booking = createBooking({
      barber_id: barber.id,
      shop_id: shop.id,
      service_id: service.id,
      starts_at: startISO,
      ends_at: endISO,
      price_sar: Number(service.price_sar),
      notes: notes || null,
      customer_name: name || null,
      customer_phone: phone || null,
      snapshot: {
        barber_name_en: barber.display_name_en,
        barber_name_ar: barber.display_name_ar,
        barber_photo: barber.photo_url,
        shop_name_en: shop.name_en,
        shop_name_ar: shop.name_ar,
        shop_address: shop.address ?? null,
        service_name_en: service.name_en,
        service_name_ar: service.name_ar,
        duration_min: service.duration_min,
      },
    });
    router.navigate({
      to: "/bookings/$bookingId",
      params: { bookingId: booking.id },
      search: { new: 1 } as never,
    });
  }

  if (!shop) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-2xl px-4 py-20 text-center text-sm text-muted-foreground">
          {t("common.loading")}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Top */}
      <div className="sticky top-0 z-40 border-b border-hairline bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-3">
          <button
            type="button"
            onClick={() => (stepIdx > 0 ? setStep(STEPS[stepIdx - 1]) : router.history.back())}
            className="inline-flex size-9 items-center justify-center rounded-full border border-hairline text-foreground hover:border-gold/50"
            aria-label={t("common.back")}
          >
            <ArrowBack className="size-4" />
          </button>
          <p className="text-xs text-muted-foreground">
            {t("booking.step")} {stepIdx + 1} {t("booking.of")} {STEPS.length}
          </p>
          <Link to="/" className="group inline-flex items-center gap-2 rounded-full border border-hairline px-2 py-1 transition-colors hover:border-gold/50" aria-label={t("brand")}>
            <span className="inline-flex size-7 items-center justify-center rounded-full border border-gold/40 gold-hairline">
              <img src={logoUrl} alt="" width={28} height={28} className="size-5 object-contain" />
            </span>
            <span className="hidden font-display text-sm font-semibold text-foreground sm:inline">{t("brand")}</span>
          </Link>
        </div>
        <div className="mx-auto flex max-w-2xl gap-1 px-3 pb-3">
          {STEPS.map((_, i) => (
            <div key={i} className={cn("h-0.5 flex-1 rounded-full", i <= stepIdx ? "bg-gold" : "bg-hairline")} />
          ))}
        </div>
      </div>

      <header className="mx-auto max-w-2xl px-4 pt-8">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {t("booking.title")}
        </p>
        <h1 className="mt-2 font-display text-3xl tracking-tight text-foreground sm:text-4xl">
          {t(`booking.step${cap(search.step)}`)}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("booking.at")} {tt(shop.name_en, shop.name_ar)}
        </p>
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-8">
        {search.step === "service" && (
          <div className="space-y-3">
            {shop.services.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => pickService(s.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-4 rounded-2xl border p-4 text-start transition-all",
                  search.service === s.id
                    ? "border-gold/60 bg-gold/5 gold-glow"
                    : "border-hairline bg-surface hover:border-gold/40",
                )}
              >
                <div className="min-w-0">
                  <h3 className="truncate font-medium text-foreground">{tt(s.name_en, s.name_ar)}</h3>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="size-3" />
                    {s.duration_min} {t("service.min")}
                  </p>
                </div>
                <p className="text-sm font-semibold text-gold">
                  {t("service.sar")} {formatPrice(Number(s.price_sar), lng)}
                </p>
              </button>
            ))}
          </div>
        )}

        {search.step === "barber" && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => pickBarber("any")}
              className={cn(
                "flex w-full items-center justify-between gap-4 rounded-2xl border p-4 text-start transition-all",
                search.barber === "any"
                  ? "border-gold/60 bg-gold/5 gold-glow"
                  : "border-hairline bg-surface hover:border-gold/40",
              )}
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex size-12 items-center justify-center rounded-full border border-gold/40 bg-gold/5 text-gold">
                  <Shuffle className="size-5" />
                </span>
                <div>
                  <h3 className="font-medium text-foreground">{t("barberSelect.noPreference")}</h3>
                  <p className="text-xs text-muted-foreground">{t("barberSelect.noPreferenceSub")}</p>
                </div>
              </div>
              <span className="rounded-full border border-gold/40 px-3 py-1 text-xs text-gold">
                {t("barberSelect.select")}
              </span>
            </button>

            {shop.barbers.map((b) => (
              <div key={b.id} className={cn(
                "flex items-center justify-between gap-3 rounded-2xl border p-4",
                search.barber === b.id ? "border-gold/60 bg-gold/5 gold-glow" : "border-hairline bg-surface",
              )}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative">
                    <img src={b.photo_url ?? ""} alt="" className="size-12 rounded-full object-cover ring-1 ring-gold/40" />
                    <span className="absolute -bottom-1 -end-1 inline-flex items-center gap-0.5 rounded-full bg-background px-1.5 py-0.5 text-[10px] text-gold ring-1 ring-gold/40">
                      <Star className="size-2.5" fill="currentColor" />
                      {Number(b.rating_avg).toFixed(1)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {tt(b.display_name_en, b.display_name_ar)}
                    </p>
                    <p className="text-xs text-muted-foreground">{tt(b.title_en, b.title_ar)}</p>
                    <Link
                      to="/barbers/$barberId"
                      params={{ barberId: b.id }}
                      className="text-[11px] text-gold hover:underline"
                    >
                      {t("barberSelect.viewProfile")}
                    </Link>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => pickBarber(b.id)}
                  className="rounded-full border border-gold/50 px-4 py-2 text-xs font-medium text-gold transition-colors hover:bg-gold hover:text-primary-foreground"
                >
                  {t("barberSelect.select")}
                </button>
              </div>
            ))}
          </div>
        )}

        {search.step === "date" && (
          <DateStep current={search.date} onPick={pickDate} />
        )}
        {search.step === "time" && (
          <TimeStep date={search.date} slots={slots} current={search.time} onPick={pickTime} />
        )}
        {search.step === "review" && service && search.date && search.time && (
          <ReviewStep
            shopName={tt(shop.name_en, shop.name_ar)}
            shopAddress={shop.address ?? `${shop.district}, ${shop.city}`}
            shopCover={shop.cover_url ?? ""}
            shopRating={Number(shop.rating_avg)}
            shopRatingCount={shop.rating_count}
            barberName={selectedBarber ? tt(selectedBarber.display_name_en, selectedBarber.display_name_ar) : t("booking.anyBarber")}
            serviceName={tt(service.name_en, service.name_ar)}
            dateLabel={formatDateLong(search.date, lng)}
            timeLabel={formatTime12(search.time, lng)}
            duration={service.duration_min}
            price={Number(service.price_sar)}
            notes={notes} setNotes={setNotes}
            name={name} setName={setName}
            phone={phone} setPhone={setPhone}
            onConfirm={confirm}
          />
        )}
      </main>

      {service && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm text-foreground">{tt(service.name_en, service.name_ar)}</p>
              <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="size-3" />
                {service.duration_min} {t("service.min")}
              </p>
            </div>
            <p className="text-sm font-semibold text-gold">
              {t("service.sar")} {formatPrice(Number(service.price_sar), lng)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

function DateStep({ current, onPick }: { current?: string; onPick: (d: string) => void }) {
  const { t } = useTranslation();
  const { lng, rtl } = useLocale();
  const [offset, setOffset] = useState(0);
  const days = useMemo(() => {
    const arr: { key: string; date: Date }[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() + offset * 14 + i);
      arr.push({ key: toRiyadhDateKey(d), date: d });
    }
    return arr;
  }, [offset]);
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <button type="button" onClick={() => setOffset((o) => Math.max(0, o - 1))} disabled={offset === 0}
          className="inline-flex size-9 items-center justify-center rounded-full border border-hairline text-foreground transition-colors hover:border-gold/50 disabled:opacity-40">
          {rtl ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </button>
        <p className="text-sm text-muted-foreground">{t("booking.pickDate")}</p>
        <button type="button" onClick={() => setOffset((o) => o + 1)}
          className="inline-flex size-9 items-center justify-center rounded-full border border-hairline text-foreground transition-colors hover:border-gold/50">
          {rtl ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {days.map((d) => {
          const weekday = new Intl.DateTimeFormat(lng === "ar" ? "ar-SA" : "en-US", { weekday: "short" }).format(d.date);
          const day = new Intl.DateTimeFormat(lng === "ar" ? "ar-SA" : "en-US", { day: "numeric" }).format(d.date);
          const month = new Intl.DateTimeFormat(lng === "ar" ? "ar-SA" : "en-US", { month: "short" }).format(d.date);
          const active = current === d.key;
          return (
            <button key={d.key} type="button" onClick={() => onPick(d.key)}
              className={cn("flex flex-col items-center rounded-2xl border px-2 py-3 text-center transition-all",
                active ? "border-gold bg-gold/10 text-gold gold-glow" : "border-hairline bg-surface text-foreground hover:border-gold/40")}>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{weekday}</span>
              <span className="mt-1 font-display text-2xl">{day}</span>
              <span className="text-[10px] text-muted-foreground">{month}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TimeStep({ date, slots, current, onPick }: { date?: string; slots: string[]; current?: string; onPick: (s: string) => void }) {
  const { t } = useTranslation();
  const { lng } = useLocale();
  if (!date) return <p className="py-10 text-center text-sm text-muted-foreground">{t("booking.pickDate")}</p>;
  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">{formatDateLong(date, lng)}</p>
      {slots.length === 0 ? (
        <p className="rounded-2xl border border-hairline bg-surface p-8 text-center text-sm text-muted-foreground">{t("booking.noSlots")}</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {slots.map((s) => (
            <button key={s} type="button" onClick={() => onPick(s)}
              className={cn("rounded-full border px-3 py-2.5 text-sm transition-all",
                current === s ? "border-gold bg-gold/10 text-gold gold-glow" : "border-hairline text-foreground hover:border-gold/40")}>
              {formatTime12(s, lng)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewStep(props: {
  shopName: string; shopAddress: string; shopCover: string; shopRating: number; shopRatingCount: number;
  barberName: string; serviceName: string; dateLabel: string; timeLabel: string; duration: number; price: number;
  notes: string; setNotes: (v: string) => void;
  name: string; setName: (v: string) => void;
  phone: string; setPhone: (v: string) => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  const { lng } = useLocale();
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-hairline bg-surface p-5">
        <div className="flex items-start gap-3">
          <img src={props.shopCover} alt="" className="size-14 rounded-xl object-cover" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg text-foreground">{props.shopName}</p>
            <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-gold">
              <Star className="size-3" fill="currentColor" />
              {props.shopRating.toFixed(1)} ({props.shopRatingCount.toLocaleString()})
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{props.shopAddress}</p>
          </div>
        </div>
        <div className="my-4 h-px bg-hairline" />
        <p className="text-xs uppercase tracking-[0.18em] text-gold">{t("booking.summary")}</p>
        <h2 className="mt-2 font-display text-xl text-foreground">{props.serviceName}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("booking.with")} {props.barberName}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <Row label={t("booking.on")} value={props.dateLabel} />
          <Row label={t("booking.at")} value={props.timeLabel} />
          <Row label={t("service.min")} value={`${props.duration} ${t("service.min")}`} />
          <Row label={t("service.sar")} value={`${t("service.sar")} ${formatPrice(props.price, lng)}`} highlight />
        </div>
      </div>

      <div className="space-y-3">
        <Field label={t("booking.yourName")} value={props.name} onChange={props.setName} placeholder={t("booking.namePh")} />
        <Field label={t("booking.yourPhone")} value={props.phone} onChange={props.setPhone} placeholder={t("booking.phonePh")} dir="ltr" />
        <div>
          <label className="mb-1 block text-xs uppercase tracking-[0.18em] text-muted-foreground">{t("booking.notes")}</label>
          <textarea value={props.notes} onChange={(e) => props.setNotes(e.target.value)} placeholder={t("booking.notesPh")} rows={3}
            className="w-full resize-none rounded-2xl border border-hairline bg-surface p-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-gold/50" />
        </div>
      </div>

      <button type="button" onClick={props.onConfirm}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gold px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-gold-glow">
        <Check className="size-4" />
        {t("booking.confirm")}
      </button>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl border border-hairline bg-background/40 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-sm", highlight ? "font-semibold text-gold" : "text-foreground")}>{value}</p>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, dir }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; dir?: "ltr" | "rtl" }) {
  return (
    <div>
      <label className="mb-1 block text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} dir={dir}
        className="w-full rounded-2xl border border-hairline bg-surface px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-gold/50" />
    </div>
  );
}
