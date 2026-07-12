import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/integrations/supabase/client";
import { toRiyadhDateKey } from "@/lib/slots";
import { BookingRow } from "./barber.index";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/barber/bookings")({
  component: BarberBookings,
});

type Filter = "today" | "upcoming" | "completed" | "cancelled";

function BarberBookings() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [filter, setFilter] = useState<Filter>("today");
  const [bookings, setBookings] = useState<any[]>([]);
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
      const { data } = await supabase
        .from("bookings")
        .select(
          "id, starts_at, ends_at, status, price_sar, customer:profiles!bookings_customer_id_fkey(full_name, email), service:services(name_en, name_ar)",
        )
        .eq("barber_id", b.id)
        .order("starts_at", { ascending: false });
      setBookings((data ?? []) as any);
      setLoading(false);
    })();
  }, [user]);

  const today = toRiyadhDateKey(new Date());
  const nowMs = Date.now();
  const filtered = useMemo(() => {
    return bookings.filter((b) => {
      const day = toRiyadhDateKey(new Date(b.starts_at));
      if (filter === "today") return day === today && b.status !== "cancelled";
      if (filter === "upcoming")
        return (
          new Date(b.starts_at).getTime() > nowMs &&
          b.status !== "cancelled" &&
          b.status !== "completed"
        );
      if (filter === "completed") return b.status === "completed";
      if (filter === "cancelled")
        return b.status === "cancelled" || b.status === "no_show";
      return true;
    });
  }, [bookings, filter, today, nowMs]);

  async function updateStatus(id: string, status: "completed" | "cancelled" | "no_show") {
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
    await supabase.from("bookings").update({ status }).eq("id", id);
  }

  if (loading) return <div className="text-muted-foreground">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">{t("barber.bookingsPage.title")}</h1>
      <div className="flex flex-wrap gap-2">
        {(["today", "upcoming", "completed", "cancelled"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm transition",
              filter === f
                ? "border-gold bg-gold text-primary-foreground"
                : "border-hairline text-muted-foreground hover:text-foreground",
            )}
          >
            {t(`barber.bookingsPage.filters.${f}`)}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-hairline bg-surface p-12 text-center text-sm text-muted-foreground">
          {t("common.empty")}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((b) => (
            <BookingRow key={b.id} b={b} onUpdate={updateStatus} />
          ))}
        </ul>
      )}
    </div>
  );
}
