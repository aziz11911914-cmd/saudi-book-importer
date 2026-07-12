import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-provider";

export type BarberRole = "customer" | "self" | "owner" | "admin";

/**
 * Returns whether the current signed-in user can edit this barber profile.
 * - self: the signed-in user IS this barber (barbers.profile_id === user.id)
 * - owner: the signed-in user manages the shop this barber belongs to
 * - admin: the signed-in user is a super_admin
 * - customer: view-only
 */
export function useBarberPermissions(barberId: string | undefined) {
  const { user, roles } = useAuth();
  const isAdmin = roles.includes("super_admin");

  const { data } = useQuery({
    enabled: !!barberId && !!user,
    queryKey: ["barber-permissions", barberId, user?.id],
    queryFn: async () => {
      if (!user || !barberId) return { role: "customer" as BarberRole };
      const { data: barber } = await supabase
        .from("barbers")
        .select("profile_id, shop_id")
        .eq("id", barberId)
        .maybeSingle();
      if (!barber) return { role: "customer" as BarberRole };
      if (barber.profile_id === user.id) return { role: "self" as BarberRole };
      if (barber.shop_id) {
        const { data: shop } = await supabase
          .from("shops")
          .select("manager_id")
          .eq("id", barber.shop_id)
          .maybeSingle();
        if (shop?.manager_id === user.id) return { role: "owner" as BarberRole };
      }
      return { role: "customer" as BarberRole };
    },
  });

  const role: BarberRole = isAdmin ? "admin" : (data?.role ?? "customer");
  const canEdit = role !== "customer";
  return { role, canEdit };
}
