import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-provider";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/owner")({
  component: OwnerHome,
});

function OwnerHome() {
  const { ready, roles, user } = useAuth();
  const [shop, setShop] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready || !user) return;
    (async () => {
      const { data } = await supabase
        .from("shops").select("id, slug, name_en, name_ar, status, city, rating_avg, rating_count")
        .eq("manager_id", user.id).maybeSingle();
      setShop(data); setLoading(false);
    })();
  }, [ready, user]);

  if (!ready) return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>;
  if (!roles.includes("owner")) {
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
  if (loading) return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading your salon…</div>;
  if (!shop) {
    return (
      <div className="mx-auto max-w-xl space-y-3 px-6 py-16 text-center">
        <h1 className="font-display text-3xl">No salon assigned yet</h1>
        <p className="text-sm text-muted-foreground">Please contact the platform administrator to be assigned to a salon.</p>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-10">
      <h1 className="font-display text-3xl">{shop.name_en}</h1>
      <p className="text-sm text-muted-foreground">{shop.city ?? ""} · {shop.status}</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-hairline bg-surface p-5"><div className="text-xs uppercase text-muted-foreground">Rating</div><div className="mt-2 font-display text-2xl">{shop.rating_avg ? `★ ${Number(shop.rating_avg).toFixed(1)}` : "—"}</div></div>
        <div className="rounded-2xl border border-hairline bg-surface p-5"><div className="text-xs uppercase text-muted-foreground">Reviews</div><div className="mt-2 font-display text-2xl">{shop.rating_count ?? 0}</div></div>
        <div className="rounded-2xl border border-hairline bg-surface p-5"><div className="text-xs uppercase text-muted-foreground">Status</div><div className="mt-2 font-display text-2xl">{shop.status}</div></div>
      </div>
      <div className="rounded-2xl border border-hairline bg-surface p-5">
        <p className="text-sm text-muted-foreground">
          The full Owner workspace (barbers, services, bookings, schedule, reviews) will be available here.
          For now you can preview your public salon page:
        </p>
        <Link to="/shops/$slug" params={{ slug: shop.slug } as any} className="mt-3 inline-block rounded-full bg-gold px-5 py-2 text-sm font-semibold text-primary-foreground">View public page</Link>
      </div>
    </div>
  );
}
