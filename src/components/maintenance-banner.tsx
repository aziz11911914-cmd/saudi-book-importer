import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Maintenance = { enabled?: boolean; message?: string | null };

export function MaintenanceBanner() {
  const [m, setM] = useState<Maintenance | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) return;
      const { data } = await supabase.from("platform_maintenance_status").select("maintenance").eq("id", 1).maybeSingle();
      if (alive) setM((data?.maintenance as any) ?? null);
    })();
    return () => { alive = false; };
  }, []);
  if (!m?.enabled) return null;
  return (
    <div className="sticky top-0 z-50 w-full border-b border-amber-500/40 bg-amber-500/15 px-4 py-2 text-center text-sm text-amber-200">
      {m.message || "The platform is currently in maintenance mode. Some features may be unavailable."}
    </div>
  );
}
