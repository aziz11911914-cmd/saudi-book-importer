import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated/barber/settings")({
  component: BarberSettings,
});

type DayRow = {
  day_of_week: number;
  is_off: boolean;
  starts_at: string;
  ends_at: string;
  break_start: string;
  break_end: string;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const empty = (i: number): DayRow => ({
  day_of_week: i,
  is_off: false,
  starts_at: "09:00",
  ends_at: "17:00",
  break_start: "",
  break_end: "",
});

function BarberSettings() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [barberId, setBarberId] = useState<string | null>(null);
  const [duration, setDuration] = useState(30);
  const [rows, setRows] = useState<DayRow[]>(DAYS.map((_, i) => empty(i)));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: b } = await supabase
        .from("barbers")
        .select("id, appointment_duration_min")
        .eq("profile_id", user.id)
        .maybeSingle();
      if (!b) {
        setLoading(false);
        return;
      }
      setBarberId(b.id);
      setDuration(b.appointment_duration_min ?? 30);
      const { data: av } = await supabase
        .from("barber_availability")
        .select("day_of_week, starts_at, ends_at, break_start, break_end, is_off")
        .eq("barber_id", b.id);
      const map = new Map<number, DayRow>();
      (av ?? []).forEach((a: any) => {
        map.set(a.day_of_week, {
          day_of_week: a.day_of_week,
          is_off: !!a.is_off,
          starts_at: (a.starts_at ?? "09:00:00").slice(0, 5),
          ends_at: (a.ends_at ?? "17:00:00").slice(0, 5),
          break_start: a.break_start ? String(a.break_start).slice(0, 5) : "",
          break_end: a.break_end ? String(a.break_end).slice(0, 5) : "",
        });
      });
      setRows(DAYS.map((_, i) => map.get(i) ?? empty(i)));
      setLoading(false);
    })();
  }, [user]);

  function update(i: number, patch: Partial<DayRow>) {
    setRows((prev) => prev.map((r) => (r.day_of_week === i ? { ...r, ...patch } : r)));
  }

  async function save() {
    if (!barberId) return;
    setSaving(true);
    setSaved(false);
    await supabase
      .from("barbers")
      .update({ appointment_duration_min: duration })
      .eq("id", barberId);
    // Replace all rows for simplicity
    await supabase.from("barber_availability").delete().eq("barber_id", barberId);
    const insert = rows.map((r) => ({
      barber_id: barberId,
      day_of_week: r.day_of_week,
      starts_at: r.is_off ? "00:00:00" : `${r.starts_at}:00`,
      ends_at: r.is_off ? "00:00:00" : `${r.ends_at}:00`,
      break_start: r.is_off || !r.break_start ? null : `${r.break_start}:00`,
      break_end: r.is_off || !r.break_end ? null : `${r.break_end}:00`,
      is_off: r.is_off,
    }));
    await supabase.from("barber_availability").insert(insert);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) return <div className="text-muted-foreground">{t("common.loading")}</div>;
  if (!barberId)
    return (
      <div className="mx-auto max-w-xl space-y-3 py-16 text-center">
        <h1 className="font-display text-3xl">No barber profile</h1>
      </div>
    );

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-3xl">{t("barber.settings.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("barber.settings.subtitle")}
        </p>
      </div>

      <section className="rounded-2xl border border-hairline bg-surface p-5">
        <h2 className="mb-3 font-display text-lg">
          {t("barber.settings.durationTitle")}
        </h2>
        <label className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">
            {t("barber.settings.durationLabel")}
          </span>
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="rounded-xl border border-hairline bg-background px-3 py-2 text-sm"
          >
            {[15, 20, 30, 45, 60, 90, 120].map((v) => (
              <option key={v} value={v}>
                {v} min
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="rounded-2xl border border-hairline bg-surface p-5">
        <h2 className="mb-4 font-display text-lg">
          {t("barber.settings.hoursTitle")}
        </h2>
        <div className="space-y-3">
          {rows.map((r, i) => (
            <div
              key={i}
              className="grid grid-cols-1 gap-3 rounded-xl border border-hairline/60 p-3 sm:grid-cols-[80px_auto_1fr_1fr_1fr_1fr]"
            >
              <div className="font-medium">{t(`barber.days.${DAYS[i].toLowerCase()}`)}</div>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={r.is_off}
                  onChange={(e) => update(i, { is_off: e.target.checked })}
                />
                {t("barber.settings.off")}
              </label>
              <TimeField
                label={t("barber.settings.open")}
                value={r.starts_at}
                disabled={r.is_off}
                onChange={(v) => update(i, { starts_at: v })}
              />
              <TimeField
                label={t("barber.settings.close")}
                value={r.ends_at}
                disabled={r.is_off}
                onChange={(v) => update(i, { ends_at: v })}
              />
              <TimeField
                label={t("barber.settings.breakStart")}
                value={r.break_start}
                disabled={r.is_off}
                onChange={(v) => update(i, { break_start: v })}
              />
              <TimeField
                label={t("barber.settings.breakEnd")}
                value={r.break_end}
                disabled={r.is_off}
                onChange={(v) => update(i, { break_end: v })}
              />
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-full bg-gold px-6 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {saving ? t("common.loading") : t("barber.settings.save")}
        </button>
        {saved && <span className="text-sm text-emerald-400">{t("barber.settings.saved")}</span>}
      </div>
    </div>
  );
}

function TimeField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <input
        type="time"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-hairline bg-background px-2 py-1.5 text-sm disabled:opacity-40"
      />
    </label>
  );
}
