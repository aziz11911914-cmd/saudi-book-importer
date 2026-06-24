// Local booking store — bridges the UX before OTP auth ships.
// All booking data lives in localStorage under "al-unwan.bookings.v1".
// When auth lands, swap these functions for createServerFn calls that
// write to public.bookings (the table + schema already exist).

export type LocalBooking = {
  id: string;
  booking_ref: string;
  barber_id: string;
  shop_id: string;
  service_id: string;
  starts_at: string; // ISO UTC
  ends_at: string; // ISO UTC
  price_sar: number;
  status: "confirmed" | "completed" | "cancelled" | "no_show";
  notes: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  // Denormalized snapshot for offline-friendly display
  snapshot: {
    barber_name_en: string;
    barber_name_ar: string;
    barber_photo: string | null;
    shop_name_en: string;
    shop_name_ar: string;
    shop_address: string | null;
    service_name_en: string;
    service_name_ar: string;
    duration_min: number;
  };
  created_at: string;
};

const KEY = "al-unwan.bookings.v1";

function read(): LocalBooking[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LocalBooking[]) : [];
  } catch {
    return [];
  }
}

function write(list: LocalBooking[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent("al-unwan:bookings-changed"));
}

function genRef() {
  return Array.from({ length: 8 }, () =>
    "0123456789ABCDEF"[Math.floor(Math.random() * 16)],
  ).join("");
}

export function listBookings(): LocalBooking[] {
  return read().sort((a, b) => (a.starts_at < b.starts_at ? 1 : -1));
}

export function getBooking(id: string): LocalBooking | null {
  return read().find((b) => b.id === id) ?? null;
}

export function getBookingsForBarberOnDate(barberId: string, dateISO: string) {
  // dateISO = YYYY-MM-DD (Riyadh local). Returns active bookings overlapping that day.
  const day = dateISO;
  return read().filter(
    (b) =>
      b.barber_id === barberId &&
      b.status !== "cancelled" &&
      b.status !== "no_show" &&
      b.starts_at.slice(0, 10) === day,
  );
}

export function createBooking(
  input: Omit<LocalBooking, "id" | "booking_ref" | "status" | "created_at">,
): LocalBooking {
  const list = read();
  const booking: LocalBooking = {
    ...input,
    id: crypto.randomUUID(),
    booking_ref: genRef(),
    status: "confirmed",
    created_at: new Date().toISOString(),
  };
  list.push(booking);
  write(list);
  return booking;
}

export function updateBookingTime(
  id: string,
  starts_at: string,
  ends_at: string,
) {
  const list = read();
  const i = list.findIndex((b) => b.id === id);
  if (i < 0) return null;
  list[i] = { ...list[i], starts_at, ends_at };
  write(list);
  return list[i];
}

export function cancelBooking(id: string) {
  const list = read();
  const i = list.findIndex((b) => b.id === id);
  if (i < 0) return null;
  list[i] = { ...list[i], status: "cancelled" };
  write(list);
  return list[i];
}
