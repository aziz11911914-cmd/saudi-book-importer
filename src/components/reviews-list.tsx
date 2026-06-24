import { Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocale } from "@/lib/locale-provider";

export type DemoReview = {
  id: string;
  reviewer_name: string;
  rating: number;
  comment: string;
  created_at: string;
};

export function ReviewsList({ reviews }: { reviews: DemoReview[] }) {
  const { t } = useTranslation();
  const { lng } = useLocale();
  if (reviews.length === 0) {
    return (
      <p className="rounded-2xl border border-hairline bg-surface/40 p-8 text-center text-sm text-muted-foreground">
        {t("shop.noReviews")}
      </p>
    );
  }
  const fmt = new Intl.DateTimeFormat(lng === "ar" ? "ar-SA" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  return (
    <ul className="space-y-3">
      {reviews.map((r) => (
        <li
          key={r.id}
          className="rounded-2xl border border-hairline bg-surface/60 p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-9 items-center justify-center rounded-full border border-gold/40 bg-gold/5 text-xs font-semibold text-gold">
                {r.reviewer_name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {r.reviewer_name}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {fmt.format(new Date(r.created_at))}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-0.5 text-gold">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className="size-3.5"
                  fill={i < r.rating ? "currentColor" : "none"}
                />
              ))}
            </div>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {r.comment}
          </p>
        </li>
      ))}
    </ul>
  );
}
