import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/integrations/supabase/client";
import { toRiyadhDateKey } from "@/lib/slots";
import { CalendarClock, CheckCircle2, XCircle, UserX, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated/barber/")({
  component: BarberDashboard,
});

type Booking = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  price_sar: number | null;
  customer: { full_name: string | null; email: string | null } | null;
  service: { name_en: string | null; name_ar: string | null } | null;
};

function BarberDashboard() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [barberId, setBarberId] = useState<string | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: b } = await supabase
        .from("barbers")
        .select("id")
        .eq("profile_id", user.id)
        .maybeSingle();
      if (!b) {
        setLoading(false);
        return;
      }
      setBarberId(b.id);
      const { data } = await supabase
        .from("bookings")
        .select(
          "id, starts_at, ends_at, status, price_sar, customer:profiles!bookings_customer_id_fkey(full_name, email), service:services(name_en, name_ar)",
        )
        .eq("barber_id", b.id)
        .order("starts_at", { ascending: true });
      setBookings((data ?? []) as any);
      setLoading(false);
    })();
  }, [user]);

  const today = toRiyadhDateKey(new Date());
  const nowMs = Date.now();
  const { todays, upcoming, completed } = useMemo(() => {
    const t: Booking[] = [];
    const u: Booking[] = [];
    let c = 0;
    for (const b of bookings) {
      const day = toRiyadhDateKey(new Date(b.starts_at));
      if (b.status === "completed") c += 1;
      if (day === today && b.status !== "cancelled") t.push(b);
      else if (
        new Date(b.starts_at).getTime() > nowMs &&
        b.status !== "cancelled" &&
        b.status !== "completed"
      )
        u.push(b);
    }
    return { todays: t, upcoming: u.slice(0, 5), completed: c };
  }, [bookings, today, nowMs]);

  async function updateStatus(id: string, status: string) {
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
    await supabase.from("bookings").update({ status }).eq("id", id);
  }

  if (loading)
    return <div className="text-muted-foreground">{t("common.loading")}</div>;
  if (!barberId)
    return (
      <div className="mx-auto max-w-xl space-y-3 py-16 text-center">
        <h1 className="font-display text-3xl">No barber profile</h1>
        <p className="text-sm text-muted-foreground">
          Please contact your salon owner to be added as a barber.
        </p>
      </div>
    );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl">{t("barber.dashboard.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("barber.dashboard.subtitle")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t("barber.dashboard.today")} value={todays.length} />
        <StatCard label={t("barber.dashboard.upcoming")} value={upcoming.length} />
        <StatCard label={t("barber.dashboard.completed")} value={completed} />
      </div>

      <section className="rounded-2xl border border-hairline bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg">{t("barber.dashboard.todaySchedule")}</h2>
          <Link to="/barber/bookings" className="text-xs text-gold hover:underline">
            {t("barber.dashboard.viewAll")}
          </Link>
        </div>
        {todays.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("barber.dashboard.emptyToday")}
          </p>
        ) : (
          <ul className="space-y-2">
            {todays.map((b) => (
              <BookingRow key={b.id} b={b} onUpdate={updateStatus} />
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-hairline bg-surface p-5">
        <h2 className="mb-4 font-display text-lg">
          {t("barber.dashboard.upcomingTitle")}
        </h2>
        {upcoming.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("barber.dashboard.emptyUpcoming")}
          </p>
        ) : (
          <ul className="space-y-2">
            {upcoming.map((b) => (
              <BookingRow key={b.id} b={b} onUpdate={updateStatus} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-hairline bg-surface p-5">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 font-display text-3xl text-gold">{value}</div>
    </div>
  );
}

export function BookingRow({
  b,
  onUpdate,
}: {
  b: Booking;
  onUpdate: (id: string, status: string) => void;
}) {
  const { t } = useTranslation();
  const time = new Date(b.starts_at).toLocaleString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  });
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline/60 p-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Clock className="size-3.5 text-gold" />
          {time}
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          {b.customer?.full_name || b.customer?.email || "—"} ·{" "}
          {b.service?.name_en || "Service"}
          {b.price_sar != null && ` · ${b.price_sar} SAR`}
        </div>
        <div className="mt-1 text-xs uppercase text-muted-foreground">
          {b.status}
        </div>
      </div>
      {b.status !== "completed" &&
        b.status !== "cancelled" &&
        b.status !== "no_show" && (
          <div className="flex gap-2">
            <button
              onClick={() => onUpdate(b.id, "completed")}
              className="inline-flex items-center gap-1 rounded-full border border-emerald-500/50 px-3 py-1.5 text-xs text-emerald-400 hover:bg-emerald-500/10"
            >
              <CheckCircle2 className="size-3" />
              {t("barber.actions.complete")}
            </button>
            <button
              onClick={() => onUpdate(b.id, "cancelled")}
              className="inline-flex items-center gap-1 rounded-full border border-rose-500/50 px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-500/10"
            >
              <XCircle className="size-3" />
              {t("barber.actions.cancel")}
            </button>
            <button
              onClick={() => onUpdate(b.id, "no_show")}
              className="inline-flex items-center gap-1 rounded-full border border-amber-500/50 px-3 py-1.5 text-xs text-amber-400 hover:bg-amber-500/10"
            >
              <UserX className="size-3" />
              {t("barber.actions.noShow")}
            </button>
          </div>
        )}
    </li>
  );
}
