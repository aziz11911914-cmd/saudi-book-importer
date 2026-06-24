import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { useLocale } from "@/lib/locale-provider";
import { fetchBarberAvailability } from "@/lib/queries";
import {
  computeSlots,
  formatDateLong,
  formatTime12,
  riyadhLocalToUtcISO,
  toRiyadhDateKey,
} from "@/lib/slots";
import {
  getBooking,
  updateBookingTime,
  type LocalBooking,
} from "@/lib/booking-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/bookings/$bookingId/reschedule")({
  head: () => ({ meta: [{ title: "Reschedule — Qassah" }] }),
  component: ReschedulePage,
});

function ReschedulePage() {
  const { bookingId } = Route.useParams();
  const router = useRouter();
  const { t } = useTranslation();
  const { lng, rtl } = useLocale();
  const ArrowBack = rtl ? ArrowRight : ArrowLeft;

  const [booking, setBooking] = useState<LocalBooking | null>(null);
  const [date, setDate] = useState<string | undefined>();
  const [time, setTime] = useState<string | undefined>();
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const b = getBooking(bookingId);
    setBooking(b);
    if (b) setDate(b.starts_at.slice(0, 10));
  }, [bookingId]);

  const { data: availability = [] } = useQuery({
    queryKey: ["availability", booking?.barber_id],
    queryFn: () => fetchBarberAvailability(booking!.barber_id),
    enabled: !!booking,
  });

  const days = useMemo(() => {
    const arr: { key: string; date: Date }[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() + offset * 14 + i);
      arr.push({ key: toRiyadhDateKey(d), date: d });
    }
    return arr;
  }, [offset]);

  const slots = useMemo(() => {
    if (!booking || !date) return [];
    return computeSlots({
      dateISO: date,
      durationMin: booking.snapshot.duration_min,
      availability,
      barberId: booking.barber_id,
      ignoreBookingId: booking.id,
    });
  }, [booking, date, availability]);

  if (!booking) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="mx-auto max-w-2xl px-4 py-20 text-center text-sm text-muted-foreground">
          {t("common.loading")}
        </div>
      </div>
    );
  }

  function save() {
    if (!booking || !date || !time) return;
    const startISO = riyadhLocalToUtcISO(date, time);
    const endISO = new Date(
      new Date(startISO).getTime() + booking.snapshot.duration_min * 60_000,
    ).toISOString();
    updateBookingTime(booking.id, startISO, endISO);
    router.navigate({
      to: "/bookings/$bookingId",
      params: { bookingId: booking.id },
    });
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 border-b border-hairline bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-3">
          <button
            type="button"
            onClick={() => router.history.back()}
            className="inline-flex size-9 items-center justify-center rounded-full border border-hairline text-foreground hover:border-gold/50"
          >
            <ArrowBack className="size-4" />
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 pt-10">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {t("booking.rescheduleTitle")}
        </p>
        <h1 className="mt-2 font-display text-3xl tracking-tight text-foreground sm:text-4xl">
          {t("booking.stepDate")}
        </h1>

        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setOffset((o) => Math.max(0, o - 1))}
            disabled={offset === 0}
            className="inline-flex size-9 items-center justify-center rounded-full border border-hairline text-foreground hover:border-gold/50 disabled:opacity-40"
          >
            {rtl ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          </button>
          <p className="text-sm text-muted-foreground">{t("booking.pickDate")}</p>
          <button
            type="button"
            onClick={() => setOffset((o) => o + 1)}
            className="inline-flex size-9 items-center justify-center rounded-full border border-hairline text-foreground hover:border-gold/50"
          >
            {rtl ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-7">
          {days.map((d) => {
            const weekday = new Intl.DateTimeFormat(lng === "ar" ? "ar-SA" : "en-US", {
              weekday: "short",
            }).format(d.date);
            const day = new Intl.DateTimeFormat(lng === "ar" ? "ar-SA" : "en-US", {
              day: "numeric",
            }).format(d.date);
            const active = date === d.key;
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => {
                  setDate(d.key);
                  setTime(undefined);
                }}
                className={cn(
                  "flex flex-col items-center rounded-2xl border px-2 py-3 text-center transition-all",
                  active
                    ? "border-gold bg-gold/10 text-gold gold-glow"
                    : "border-hairline bg-surface text-foreground hover:border-gold/40",
                )}
              >
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {weekday}
                </span>
                <span className="mt-1 font-display text-2xl">{day}</span>
              </button>
            );
          })}
        </div>

        <h2 className="mt-10 font-display text-2xl text-foreground">
          {t("booking.stepTime")}
        </h2>
        {date && (
          <p className="mt-1 text-sm text-muted-foreground">{formatDateLong(date, lng)}</p>
        )}
        <div className="mt-4">
          {slots.length === 0 ? (
            <p className="rounded-2xl border border-hairline bg-surface p-8 text-center text-sm text-muted-foreground">
              {t("booking.noSlots")}
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setTime(s)}
                  className={cn(
                    "rounded-full border px-3 py-2.5 text-sm transition-all",
                    time === s
                      ? "border-gold bg-gold/10 text-gold gold-glow"
                      : "border-hairline text-foreground hover:border-gold/40",
                  )}
                >
                  {formatTime12(s, lng)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <p className="text-xs text-muted-foreground">
            {date && time
              ? `${formatDateLong(date, lng)} · ${formatTime12(time, lng)}`
              : t("booking.pickTime")}
          </p>
          <button
            type="button"
            disabled={!date || !time}
            onClick={save}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-gold-glow disabled:opacity-40"
          >
            <Check className="size-4" />
            {t("booking.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
