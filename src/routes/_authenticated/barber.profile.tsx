import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated/barber/profile")({
  component: BarberMyProfileRedirect,
});

/**
 * "My Profile" reuses the exact same customer profile page.
 * We redirect to /barbers/{myBarberId} — the same URL a customer visits.
 * Edit controls appear inline there because useBarberPermissions() detects self.
 */
function BarberMyProfileRedirect() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("barbers")
        .select("id")
        .eq("profile_id", user.id)
        .maybeSingle();
      if (!data) {
        setError("no_barber");
        return;
      }
      navigate({
        to: "/barbers/$barberId",
        params: { barberId: data.id },
        replace: true,
      });
    })();
  }, [user, navigate]);

  if (error === "no_barber") {
    return (
      <div className="mx-auto max-w-xl space-y-3 py-16 text-center">
        <h1 className="font-display text-3xl">No barber profile</h1>
        <p className="text-sm text-muted-foreground">
          Please contact your salon owner to be added as a barber.
        </p>
      </div>
    );
  }
  return <div className="text-muted-foreground">{t("common.loading")}</div>;
}
