import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data.user) return { user: data.user };
    } catch {
      // If the backend is briefly unreachable, allow the protected UI to mount
      // from the existing local session instead of leaving the app on a blank loader.
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) return { user: data.session.user };
    }

    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) {
      throw redirect({
        to: "/auth",
        search: { redirect: location.href },
      });
    }
    return { user: data.session.user };
  },
  component: () => <Outlet />,
});
