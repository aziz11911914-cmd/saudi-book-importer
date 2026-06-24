import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Calendar, CheckCircle2, Clock, MapPin, Pencil, X } from "lucide-react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { SiteHeader } from "@/components/layout/site-header";
import { useLocale } from "@/lib/locale-provider";
import {
  cancelBooking,
  getBooking,
  type LocalBooking,
} from "@/lib/booking-store";
import { formatDateLong, formatTime12 } from "@/lib/slots";
import { formatPrice } from "@/lib/format";

const searchSchema = z.object({
  new: fallback(z.coerce.number().optional(), undefined),
});

export const Route = createFileRoute("/bookings/$bookingId")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({ meta: [{ title: "Booking — Qassah" }] }),
  component: BookingDetailsPage,
});

function BookingDetailsPage() {
  const { bookingId } = Route.useParams();
  const { new: isNew } = Route.useSearch();
  const { t } = useTranslation();
  const { t: tt, lng, rtl } = useLocale();
  const router = useRouter();
  const navigate = useNavigate();
  const ArrowBack = rtl ? ArrowRight : ArrowLeft;
  const [booking, setBooking] = useState<LocalBooking | null>(null);

  useEffect(() => {
    setBooking(getBooking(bookingId));
  }, [bookingId]);

  if (!booking) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="mx-auto max-w-2xl px-4 py-20 text-center text-sm text-muted-foreground">
          {t("common.empty")}
        </div>
      </div>
    );
  }

  function onCancel() {
    if (!booking) return;
    if (!confirm(t("booking.cancelConfirm"))) return;
    cancelBooking(booking.id);
    setBooking(getBooking(booking.id));
  }

  const dateLabel = formatDateLong(booking.starts_at.slice(0, 10), lng);
  const timeLabel = formatTime12(timeFromISO(booking.starts_at), lng);
  const isUpcoming =
    booking.status === "confirmed" &&
    new Date(booking.starts_at).getTime() > Date.now();

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 border-b border-hairline bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-3">
          <button
            type="button"
            onClick={() => router.history.back()}
            className="inline-flex size-9 items-center justify-center rounded-full border border-hairline text-foreground hover:border-gold/50"
            aria-label={t("common.back")}
          >
            <ArrowBack className="size-4" />
          </button>
          <Link to="/bookings" className="text-xs text-gold hover:underline">
            {t("booking.viewAll")}
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 pt-10">
        {isNew && (
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-gold/10 ring-1 ring-gold/40">
              <CheckCircle2 className="size-8 text-gold" />
            </div>
            <h1 className="mt-5 font-display text-3xl tracking-tight text-foreground sm:text-4xl">
              {t("booking.success")}
            </h1>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              {t("booking.successSub")}
            </p>
          </div>
        )}

        {/* Card */}
        <div className="rounded-3xl border border-hairline bg-surface p-6 gold-hairline">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <img
                src={booking.snapshot.barber_photo ?? ""}
                alt=""
                className="size-14 rounded-full object-cover ring-1 ring-gold/40"
              />
              <div>
                <p className="font-display text-xl text-foreground">
                  {tt(booking.snapshot.barber_name_en, booking.snapshot.barber_name_ar)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {tt(booking.snapshot.shop_name_en, booking.snapshot.shop_name_ar)}
                </p>
              </div>
            </div>
            <span className="rounded-full border border-gold/40 bg-gold/5 px-3 py-1 text-[10px] uppercase tracking-wider text-gold">
              {t(`booking.status${cap(booking.status === "no_show" ? "NoShow" : booking.status)}`)}
            </span>
          </div>

          <div className="my-6 h-px bg-hairline" />

          <h2 className="font-display text-2xl text-foreground">
            {tt(booking.snapshot.service_name_en, booking.snapshot.service_name_ar)}
          </h2>

          <div className="mt-5 space-y-3 text-sm">
            <Row icon={<Calendar className="size-4 text-gold" />} value={dateLabel} />
            <Row
              icon={<Clock className="size-4 text-gold" />}
              value={`${timeLabel} · ${booking.snapshot.duration_min} ${t("service.min")}`}
            />
            {booking.snapshot.shop_address && (
              <Row
                icon={<MapPin className="size-4 text-gold" />}
                value={booking.snapshot.shop_address}
              />
            )}
          </div>

          <div className="my-6 h-px bg-hairline" />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {t("booking.ref")}
              </p>
              <p className="mt-1 font-mono text-sm text-foreground">
                {booking.booking_ref}
              </p>
            </div>
            <p className="font-display text-2xl text-gold">
              {t("service.sar")} {formatPrice(booking.price_sar, lng)}
            </p>
          </div>

          {booking.notes && (
            <>
              <div className="my-6 h-px bg-hairline" />
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                {t("booking.notes")}
              </p>
              <p className="mt-1 text-sm text-foreground">{booking.notes}</p>
            </>
          )}
        </div>

        {/* Actions */}
        {isUpcoming && (
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() =>
                navigate({
                  to: "/bookings/$bookingId/reschedule",
                  params: { bookingId: booking.id },
                })
              }
              className="inline-flex items-center justify-center gap-2 rounded-full border border-gold/40 bg-gold/5 px-5 py-3 text-sm font-medium text-gold transition-colors hover:bg-gold/10"
            >
              <Pencil className="size-4" />
              {t("booking.reschedule")}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-destructive/40 bg-destructive/5 px-5 py-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
            >
              <X className="size-4" />
              {t("booking.cancel")}
            </button>
          </div>
        )}

        <Link
          to="/barbers/$barberId"
          params={{ barberId: booking.barber_id }}
          className="mt-6 block text-center text-sm text-gold hover:underline"
        >
          {t("barber.viewProfile")}
        </Link>
      </div>
    </div>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Row({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <div className="flex items-center gap-3 text-foreground">
      {icon}
      <span>{value}</span>
    </div>
  );
}

function timeFromISO(iso: string) {
  const d = new Date(new Date(iso).getTime() + 3 * 60 * 60 * 1000);
  return d.toISOString().slice(11, 16);
}
