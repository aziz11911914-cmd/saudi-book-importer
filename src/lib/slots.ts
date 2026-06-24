// Slot computation in Asia/Riyadh (UTC+3, no DST).
import { getBookingsForBarberOnDate } from "./booking-store";

export type Availability = {
  day_of_week: number; // 0=Sun .. 6=Sat
  starts_at: string; // "HH:MM:SS"
  ends_at: string;
};

const RIYADH_OFFSET = "+03:00";

export function toRiyadhDateKey(d: Date): string {
  // Returns YYYY-MM-DD as seen in Riyadh local time.
  const utcMs = d.getTime();
  const riyadh = new Date(utcMs + 3 * 60 * 60 * 1000);
  return riyadh.toISOString().slice(0, 10);
}

export function riyadhLocalToUtcISO(dateISO: string, hhmm: string): string {
  // Build an ISO string in Riyadh local and let JS convert to UTC.
  const d = new Date(`${dateISO}T${hhmm}:00${RIYADH_OFFSET}`);
  return d.toISOString();
}

export function riyadhDayOfWeek(dateISO: string): number {
  // Day-of-week for a Riyadh-local calendar date.
  const d = new Date(`${dateISO}T12:00:00${RIYADH_OFFSET}`);
  // getUTCDay would shift; we want the day as named in Riyadh.
  // Since RIYADH = UTC+3 and we anchored at noon, UTC day matches Riyadh day.
  return d.getUTCDay();
}

export function formatTime12(hhmm: string, lng: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return new Intl.DateTimeFormat(lng === "ar" ? "ar-SA" : "en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export function formatDateLong(dateISO: string, lng: string): string {
  const d = new Date(`${dateISO}T12:00:00${RIYADH_OFFSET}`);
  return new Intl.DateTimeFormat(lng === "ar" ? "ar-SA" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function minutesToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const STEP_MIN = 30;

export function computeSlots({
  dateISO,
  durationMin,
  availability,
  barberId,
  ignoreBookingId,
}: {
  dateISO: string;
  durationMin: number;
  availability: Availability[];
  barberId: string;
  ignoreBookingId?: string;
}): string[] {
  const dow = riyadhDayOfWeek(dateISO);
  const windows = availability.filter((a) => a.day_of_week === dow);
  if (!windows.length) return [];

  const existing = getBookingsForBarberOnDate(barberId, dateISO).filter(
    (b) => b.id !== ignoreBookingId,
  );

  const nowMs = Date.now();
  const slots: string[] = [];
  for (const w of windows) {
    const start = hhmmToMinutes(w.starts_at.slice(0, 5));
    const end = hhmmToMinutes(w.ends_at.slice(0, 5));
    for (let t = start; t + durationMin <= end; t += STEP_MIN) {
      const hhmm = minutesToHHMM(t);
      const startISO = riyadhLocalToUtcISO(dateISO, hhmm);
      const startMs = new Date(startISO).getTime();
      const endMs = startMs + durationMin * 60_000;
      if (startMs <= nowMs + 15 * 60_000) continue; // 15-min lead time
      const conflicts = existing.some((b) => {
        const bs = new Date(b.starts_at).getTime();
        const be = new Date(b.ends_at).getTime();
        return startMs < be && endMs > bs;
      });
      if (!conflicts) slots.push(hhmm);
    }
  }
  return slots;
}
