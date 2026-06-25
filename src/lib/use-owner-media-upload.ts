import { useServerFn } from "@tanstack/react-start";
import { createSalonUploadUrl } from "@/lib/owner-salon.functions";
import { supabase } from "@/integrations/supabase/client";

export function useOwnerMediaUpload() {
  const sign = useServerFn(createSalonUploadUrl);
  return async function upload(
    file: File,
    bucket: "salon-media" | "service-media",
  ): Promise<string> {
    const safe = file.name.replace(/[^A-Za-z0-9._-]/g, "_");
    const { path, token, publicUrl } = await sign({
      data: { bucket, filename: safe },
    });
    const { error } = await supabase.storage
      .from(bucket)
      .uploadToSignedUrl(path, token, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
    if (error) throw error;
    return publicUrl;
  };
}
