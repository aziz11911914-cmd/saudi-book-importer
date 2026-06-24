import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { MapPin } from "lucide-react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { SiteHeader } from "@/components/layout/site-header";
import { SpecialtyChip } from "@/components/specialty-chip";
import { StarRating } from "@/components/star-rating";
import { useLocale } from "@/lib/locale-provider";
import { fetchBarbersList, fetchSpecialties } from "@/lib/queries";

const searchSchema = z.object({
  specialty: fallback(z.string(), "all").default("all"),
});

export const Route = createFileRoute("/barbers/")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Browse barbers — Qassah" },
      {
        name: "description",
        content:
          "Browse the best barbers in Saudi Arabia. Filter by haircut specialty and book in one tap.",
      },
    ],
  }),
  component: BarbersListPage,
});

function BarbersListPage() {
  const { t } = useTranslation();
  const { t: tt } = useLocale();
  const { specialty } = Route.useSearch();
  const navigate = useNavigate({ from: "/barbers/" });

  const { data: specialties = [] } = useQuery({
    queryKey: ["specialties"],
    queryFn: fetchSpecialties,
  });
  const { data: barbers = [], isLoading } = useQuery({
    queryKey: ["barbers", specialty],
    queryFn: () => fetchBarbersList(specialty),
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-4xl tracking-tight text-foreground sm:text-5xl">
          {t("nav.barbers")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("home.heroSubtitle")}
        </p>

        {/* Filter chips */}
        <div className="mt-6 flex flex-wrap gap-2">
          <SpecialtyChip
            active={specialty === "all"}
            onClick={() => navigate({ search: { specialty: "all" } })}
          >
            {t("specialties.all")}
          </SpecialtyChip>
          {specialties.map((s) => (
            <SpecialtyChip
              key={s.id}
              active={specialty === s.slug}
              onClick={() => navigate({ search: { specialty: s.slug } })}
            >
              {tt(s.label_en, s.label_ar)}
            </SpecialtyChip>
          ))}
        </div>

        {/* Grid */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading && (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          )}
          {barbers.map((b) => (
            <Link
              key={b.id}
              to="/barbers/$barberId"
              params={{ barberId: b.id }}
              className="group flex gap-4 rounded-2xl border border-hairline bg-surface p-4 transition-all hover:border-gold/40"
            >
              <div
                className="size-24 shrink-0 rounded-xl bg-cover bg-center ring-1 ring-gold/20"
                style={{ backgroundImage: `url(${b.photo_url})` }}
              />
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-medium text-foreground">
                  {tt(b.display_name_en, b.display_name_ar)}
                </h3>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {tt(b.shop?.name_en ?? "", b.shop?.name_ar ?? "")}
                </p>
                <div className="mt-2">
                  <StarRating value={Number(b.rating_avg)} count={b.rating_count} />
                </div>
                <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="size-3" />
                  {b.shop?.district}, {b.shop?.city}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {b.barber_specialties.slice(0, 3).map((bs) => (
                    <SpecialtyChip key={bs.specialty.id} size="sm">
                      {tt(bs.specialty.label_en, bs.specialty.label_ar)}
                    </SpecialtyChip>
                  ))}
                </div>
              </div>
            </Link>
          ))}
          {!isLoading && barbers.length === 0 && (
            <p className="col-span-full py-16 text-center text-sm text-muted-foreground">
              {t("common.empty")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
