import { supabase } from "@/integrations/supabase/client";
import { resolveAssetUrl } from "@/lib/format";

const URL_KEYS = new Set(["url", "photo_url", "cover_url", "image_url"]);

function rewriteUrls<T>(value: T): T {
  if (value == null) return value;
  if (Array.isArray(value)) {
    return value.map((v) => rewriteUrls(v)) as never;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = { ...(value as Record<string, unknown>) };
    for (const k of Object.keys(out)) {
      const v = out[k];
      if (typeof v === "string" && URL_KEYS.has(k)) {
        out[k] = resolveAssetUrl(v);
      } else if (v && typeof v === "object") {
        out[k] = rewriteUrls(v);
      }
    }
    return out as never;
  }
  return value;
}


export type Specialty = {
  id: string;
  slug: string;
  label_en: string;
  label_ar: string;
  sort_order: number;
};

export type Barber = {
  id: string;
  shop_id: string;
  slug: string;
  display_name_en: string;
  display_name_ar: string;
  title_en: string;
  title_ar: string;
  bio_en: string | null;
  bio_ar: string | null;
  photo_url: string | null;
  years_experience: number;
  rating_avg: number;
  rating_count: number;
  appointments_completed: number;
  clients_served: number;
  featured: boolean;
};

export type Shop = {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string;
  description_en: string | null;
  description_ar: string | null;
  cover_url: string | null;
  lat: number | null;
  lng: number | null;
  address: string | null;
  city: string | null;
  district: string | null;
  phone: string | null;
  rating_avg: number;
  rating_count: number;
  featured: boolean;
};

export type Service = {
  id: string;
  shop_id: string;
  name_en: string;
  name_ar: string;
  description_en: string | null;
  description_ar: string | null;
  price_sar: number;
  duration_min: number;
  category: string;
};

export async function fetchSpecialties(): Promise<Specialty[]> {
  const { data, error } = await supabase
    .from("specialties")
    .select("*")
    .order("sort_order");
  if (error) throw error;
  return data as Specialty[];
}

export async function fetchFeaturedBarbers(): Promise<
  (Barber & { shop: Pick<Shop, "name_en" | "name_ar" | "city" | "district"> })[]
> {
  const { data, error } = await supabase
    .from("barbers")
    .select(
      "*, shop:shops(name_en, name_ar, city, district)",
    )
    .eq("status", "active")
    .order("featured", { ascending: false })
    .order("rating_avg", { ascending: false })
    .limit(12);
  if (error) throw error;
  return (data ?? []) as never;
}

export async function fetchFeaturedShops(): Promise<Shop[]> {
  const { data, error } = await supabase
    .from("shops")
    .select("*")
    .eq("status", "active")
    .order("featured", { ascending: false })
    .order("rating_avg", { ascending: false })
    .limit(8);
  if (error) throw error;
  return (data ?? []) as Shop[];
}

export async function fetchBarbersList(specialtySlug?: string) {
  let q = supabase
    .from("barbers")
    .select(
      "*, shop:shops(name_en, name_ar, city, district, lat, lng), barber_specialties(specialty:specialties(id, slug, label_en, label_ar))",
    )
    .eq("status", "active");

  const { data, error } = await q.order("rating_avg", { ascending: false });
  if (error) throw error;
  let rows = (data ?? []) as never as Array<
    Barber & {
      shop: Pick<Shop, "name_en" | "name_ar" | "city" | "district" | "lat" | "lng">;
      barber_specialties: { specialty: Specialty }[];
    }
  >;
  if (specialtySlug && specialtySlug !== "all") {
    rows = rows.filter((b) =>
      b.barber_specialties.some((bs) => bs.specialty.slug === specialtySlug),
    );
  }
  return rows;
}

export async function fetchBarberFull(barberId: string) {
  const { data, error } = await supabase
    .from("barbers")
    .select(
      `*,
       shop:shops(*),
       barber_specialties(specialty:specialties(*)),
       portfolio_photos(*, portfolio_photo_specialties(specialty:specialties(*))),
       barber_services(service:services(*))`,
    )
    .eq("id", barberId)
    .maybeSingle();
  if (error) throw error;
  return data as never as
    | (Barber & {
        shop: Shop;
        barber_specialties: { specialty: Specialty }[];
        portfolio_photos: (PortfolioPhoto & {
          portfolio_photo_specialties: { specialty: Specialty }[];
        })[];
        barber_services: { service: Service }[];
      })
    | null;
}

export type PortfolioPhoto = {
  id: string;
  barber_id: string;
  url: string;
  caption_en: string | null;
  caption_ar: string | null;
  sort: number;
  starting_price_sar: number | null;
  service_id: string | null;
  created_at?: string;
};

export type PortfolioCard = PortfolioPhoto & {
  barber: Pick<Barber, "id" | "display_name_en" | "display_name_ar" | "photo_url" | "rating_avg" | "rating_count"> & {
    shop: Pick<Shop, "id" | "name_en" | "name_ar" | "city" | "district">;
    barber_services: { service: Pick<Service, "id" | "name_en" | "name_ar" | "price_sar" | "duration_min"> }[];
  };
  portfolio_photo_specialties: { specialty: Specialty }[];
};

export async function fetchPortfolioFeed(
  order: "latest" | "trending",
  limit = 12,
): Promise<PortfolioCard[]> {
  // "Latest" = newest created. "Trending" = highest-rated barbers' best work.
  const baseSelect = `*,
    portfolio_photo_specialties(specialty:specialties(*)),
    barber:barbers!inner(
      id, display_name_en, display_name_ar, photo_url, rating_avg, rating_count, status,
      shop:shops(id, name_en, name_ar, city, district),
      barber_services(service:services(id, name_en, name_ar, price_sar, duration_min))
    )`;
  let q = supabase
    .from("portfolio_photos")
    .select(baseSelect)
    .eq("barber.status", "active");
  q =
    order === "latest"
      ? q.order("created_at", { ascending: false })
      : q.order("sort", { ascending: true });
  const { data, error } = await q.limit(limit);
  if (error) throw error;
  let rows = (data ?? []) as never as PortfolioCard[];
  if (order === "trending") {
    rows = [...rows].sort(
      (a, b) => Number(b.barber.rating_avg) - Number(a.barber.rating_avg),
    );
  }
  return rows;
}

export async function fetchBarberAvailability(barberId: string) {
  const { data, error } = await supabase
    .from("barber_availability")
    .select("day_of_week, starts_at, ends_at")
    .eq("barber_id", barberId);
  if (error) throw error;
  return (data ?? []) as { day_of_week: number; starts_at: string; ends_at: string }[];
}

export async function fetchAllShops(): Promise<Shop[]> {
  const { data, error } = await supabase
    .from("shops")
    .select("*")
    .eq("status", "active")
    .order("featured", { ascending: false })
    .order("rating_avg", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Shop[];
}

export type ShopHour = { day_of_week: number; opens_at: string; closes_at: string };
export type ShopPhoto = { id: string; url: string; sort: number };
export type ShopFull = Shop & {
  shop_photos: ShopPhoto[];
  shop_hours: ShopHour[];
  services: Service[];
  barbers: (Barber & { barber_specialties: { specialty: Specialty }[] })[];
};

export async function fetchShopBySlug(slug: string): Promise<ShopFull | null> {
  const { data, error } = await supabase
    .from("shops")
    .select(
      `*,
       shop_photos(id, url, sort),
       shop_hours(day_of_week, opens_at, closes_at),
       services(*),
       barbers(*, barber_specialties(specialty:specialties(*)))`,
    )
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const full = data as never as ShopFull;
  full.shop_photos = (full.shop_photos ?? []).sort((a, b) => a.sort - b.sort);
  full.services = (full.services ?? []).filter((s) => (s as never as { active: boolean }).active !== false);
  full.barbers = (full.barbers ?? []).filter(
    (b) => (b as never as { status: string }).status === "active",
  );
  return full;
}

export type DemoReviewRow = {
  id: string;
  shop_id: string;
  barber_id: string | null;
  reviewer_name: string;
  rating: number;
  comment: string;
  created_at: string;
};

export async function fetchShopReviews(shopId: string): Promise<DemoReviewRow[]> {
  const { data, error } = await supabase
    .from("demo_reviews")
    .select("*")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DemoReviewRow[];
}

export async function fetchBarberReviews(barberId: string): Promise<DemoReviewRow[]> {
  const { data, error } = await supabase
    .from("demo_reviews")
    .select("*")
    .eq("barber_id", barberId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DemoReviewRow[];
}
