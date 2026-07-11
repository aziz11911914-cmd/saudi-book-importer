import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const BUCKETS = ["salon-media", "service-media"] as const;
type Bucket = (typeof BUCKETS)[number];

const cache = new Map<string, string>(); // key -> signed url

function parse(src: string | null | undefined): { bucket: Bucket; path: string } | null {
  if (!src) return null;
  for (const b of BUCKETS) {
    const m = src.match(
      new RegExp(`/storage/v1/object/(?:public|sign|authenticated)/${b}/([^?]+)`),
    );
    if (m) return { bucket: b, path: decodeURIComponent(m[1]) };
  }
  return null;
}

/**
 * Resolve a possibly-private Supabase storage URL into a fresh signed URL.
 * Non-storage URLs (Unsplash, http, etc.) pass through unchanged.
 */
export function useStorageUrl(src: string | null | undefined): string {
  const parsed = parse(src);
  const key = parsed ? `${parsed.bucket}/${parsed.path}` : "";
  const [resolved, setResolved] = useState<string>(() =>
    parsed ? cache.get(key) ?? "" : src ?? "",
  );

  useEffect(() => {
    if (!parsed) {
      setResolved(src ?? "");
      return;
    }
    const cached = cache.get(key);
    if (cached) {
      setResolved(cached);
      return;
    }
    let cancelled = false;
    supabase.storage
      .from(parsed.bucket)
      .createSignedUrl(parsed.path, 60 * 60)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data?.signedUrl) {
          cache.set(key, data.signedUrl);
          setResolved(data.signedUrl);
        } else {
          // fall back to original (may still fail, SafeImg will show error state)
          setResolved(src ?? "");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [key, src, parsed?.bucket, parsed?.path]);

  return resolved;
}

export function invalidateStorageUrl(src: string | null | undefined) {
  const parsed = parse(src);
  if (parsed) cache.delete(`${parsed.bucket}/${parsed.path}`);
}
