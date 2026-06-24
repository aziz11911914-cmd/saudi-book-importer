export function formatPrice(value: number | string, _locale: string) {
  const n = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

/**
 * Rewrites legacy Lovable asset URLs (/__l5e/assets-v1/<uuid>/<file>) to
 * local files served from /haircuts/<file>. Returns the original URL
 * unchanged if it doesn't match.
 */
export function resolveAssetUrl(url: string | null | undefined): string {
  if (!url) return "";
  const m = url.match(/\/__l5e\/assets-v1\/[^/]+\/([^/?#]+)/);
  if (m) return `/haircuts/${m[1]}`;
  return url;
}

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
