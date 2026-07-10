import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Maintenance = { enabled?: boolean; message?: string | null };

export function MaintenanceBanner() {
  const [m, setM] = useState<Maintenance | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.rpc("get_maintenance_status" as any);
      if (alive) setM((data as any) ?? null);
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
