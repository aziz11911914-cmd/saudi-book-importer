import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-provider";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/barber")({
  component: BarberHome,
});

function BarberHome() {
  const { ready, roles, user } = useAuth();
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready || !user) return;
    (async () => {
      const { data } = await supabase
        .from("barbers").select("id, display_name_en, photo_url, rating_avg, rating_count, status, shop_id, shops:shop_id(name_en, slug)")
        .eq("profile_id", user.id).maybeSingle();
      setMe(data); setLoading(false);
    })();
  }, [ready, user]);

  if (!ready) return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>;
  if (!roles.includes("barber")) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div className="max-w-md space-y-4">
          <ShieldAlert className="mx-auto size-12 text-gold" />
          <h1 className="font-display text-3xl">Access Denied</h1>
          <Link to="/" className="inline-block rounded-full bg-gold px-6 py-2 text-sm font-semibold text-primary-foreground">Back to home</Link>
        </div>
      </div>
    );
  }
  if (loading) return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>;
  if (!me) {
    return (
      <div className="mx-auto max-w-xl space-y-3 px-6 py-16 text-center">
        <h1 className="font-display text-3xl">No barber profile</h1>
        <p className="text-sm text-muted-foreground">Please contact your salon owner to be added as a barber.</p>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-10">
      <div className="flex items-center gap-4">
        {me.avatar_url ? <img src={me.avatar_url} alt="" className="size-16 rounded-full object-cover" /> : <div className="size-16 rounded-full bg-surface" />}
        <div>
          <h1 className="font-display text-3xl">{me.display_name_en}</h1>
          <p className="text-sm text-muted-foreground">{me.shops?.name_en} · {me.status}</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-hairline bg-surface p-5"><div className="text-xs uppercase text-muted-foreground">Rating</div><div className="mt-2 font-display text-2xl">{me.rating_avg ? `★ ${Number(me.rating_avg).toFixed(1)}` : "—"}</div></div>
        <div className="rounded-2xl border border-hairline bg-surface p-5"><div className="text-xs uppercase text-muted-foreground">Reviews</div><div className="mt-2 font-display text-2xl">{me.rating_count ?? 0}</div></div>
        <div className="rounded-2xl border border-hairline bg-surface p-5"><div className="text-xs uppercase text-muted-foreground">Status</div><div className="mt-2 font-display text-2xl">{me.status}</div></div>
      </div>
    </div>
  );
}
