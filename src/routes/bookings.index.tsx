import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { ArrowRight, ArrowLeft, Clock, MapPin } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { useLocale } from "@/lib/locale-provider";
import { listBookings, type LocalBooking } from "@/lib/booking-store";
import { formatDateLong, formatTime12 } from "@/lib/slots";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/bookings/")({
  head: () => ({ meta: [{ title: "My bookings — Qassah" }] }),
  component: BookingsListPage,
});

function BookingsListPage() {
  const { t } = useTranslation();
  const { t: tt, lng, rtl } = useLocale();
  const Arrow = rtl ? ArrowLeft : ArrowRight;
  const [bookings, setBookings] = useState<LocalBooking[]>([]);

  useEffect(() => {
    const load = () => setBookings(listBookings());
    load();
    window.addEventListener("al-unwan:bookings-changed", load);
    return () => window.removeEventListener("al-unwan:bookings-changed", load);
  }, []);

  const now = Date.now();
  const upcoming = bookings.filter(
    (b) => new Date(b.starts_at).getTime() >= now && b.status === "confirmed",
  );
  const past = bookings.filter(
    (b) => !(new Date(b.starts_at).getTime() >= now && b.status === "confirmed"),
  );

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-4xl tracking-tight text-foreground sm:text-5xl">
          {t("nav.bookings")}
        </h1>

        {bookings.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-hairline bg-surface p-10 text-center">
            <p className="text-sm text-muted-foreground">{t("booking.emptyList")}</p>
            <Link
              to="/barbers"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-gold-glow"
            >
              {t("home.ctaBrowse")}
              <Arrow className="size-4" />
            </Link>
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <Section title={t("booking.upcoming")} items={upcoming} lng={lng} tt={tt} t={t} />
            )}
            {past.length > 0 && (
              <Section title={t("booking.past")} items={past} lng={lng} tt={tt} t={t} muted />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  items,
  lng,
  tt,
  t,
  muted,
}: {
  title: string;
  items: LocalBooking[];
  lng: string;
  tt: (en: string, ar: string) => string;
  t: (k: string) => string;
  muted?: boolean;
}) {
  return (
    <section className="mt-10">
      <h2 className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </h2>
      <div className="space-y-3">
        {items.map((b) => (
          <Link
            key={b.id}
            to="/bookings/$bookingId"
            params={{ bookingId: b.id }}
            className={cn(
              "block rounded-2xl border border-hairline bg-surface p-4 transition-colors hover:border-gold/40",
              muted && "opacity-80",
            )}
          >
            <div className="flex items-start gap-4">
              <img
                src={b.snapshot.barber_photo ?? ""}
                alt=""
                className="size-14 shrink-0 rounded-full object-cover ring-1 ring-gold/30"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="truncate font-medium text-foreground">
                    {tt(b.snapshot.service_name_en, b.snapshot.service_name_ar)}
                  </h3>
                  <StatusBadge status={b.status} t={t} />
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {tt(b.snapshot.barber_name_en, b.snapshot.barber_name_ar)} ·{" "}
                  {tt(b.snapshot.shop_name_en, b.snapshot.shop_name_ar)}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3 text-gold" />
                    {formatDateLong(b.starts_at.slice(0, 10), lng)} ·{" "}
                    {formatTime12(timeFromISO(b.starts_at), lng)}
                  </span>
                  {b.snapshot.shop_address && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3" />
                      {b.snapshot.shop_address}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs text-gold">
                  {t("service.sar")} {formatPrice(b.price_sar, lng)} ·{" "}
                  <span className="text-muted-foreground">{t("booking.ref")} {b.booking_ref}</span>
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function StatusBadge({ status, t }: { status: LocalBooking["status"]; t: (k: string) => string }) {
  const map: Record<LocalBooking["status"], { label: string; cls: string }> = {
    confirmed: { label: t("booking.statusConfirmed"), cls: "border-gold/40 text-gold bg-gold/5" },
    completed: { label: t("booking.statusCompleted"), cls: "border-hairline text-foreground bg-background/40" },
    cancelled: { label: t("booking.statusCancelled"), cls: "border-destructive/40 text-destructive bg-destructive/10" },
    no_show: { label: t("booking.statusNoShow"), cls: "border-hairline text-muted-foreground" },
  };
  const m = map[status];
  return (
    <span className={cn("rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-wider", m.cls)}>
      {m.label}
    </span>
  );
}

function timeFromISO(iso: string) {
  // Convert UTC iso back to Riyadh-local HH:MM string.
  const d = new Date(new Date(iso).getTime() + 3 * 60 * 60 * 1000);
  return d.toISOString().slice(11, 16);
}
