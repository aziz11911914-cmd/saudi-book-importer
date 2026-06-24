import { Navigation } from "lucide-react";
import { useTranslation } from "react-i18next";

export function MapPreview({
  lat,
  lng,
  label,
  className,
}: {
  lat: number;
  lng: number;
  label?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  // Keyless OSM embed via Google Maps — `output=embed` doesn't require an API key.
  const src = `https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`;
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  return (
    <div className={className}>
      <div className="overflow-hidden rounded-2xl border border-hairline">
        <iframe
          title={label ?? "Location"}
          src={src}
          loading="lazy"
          width="100%"
          height="240"
          className="block grayscale"
          style={{ border: 0 }}
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
      <a
        href={directions}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-2 rounded-full border border-gold/40 px-4 py-2 text-xs font-medium text-gold transition-colors hover:bg-gold hover:text-primary-foreground"
      >
        <Navigation className="size-3.5" />
        {t("shop.getDirections")}
      </a>
    </div>
  );
}
