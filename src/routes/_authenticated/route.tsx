import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

const withTimeout = <T,>(promiseLike: PromiseLike<T>, ms = 3500) =>
  Promise.race<T>([
    Promise.resolve(promiseLike),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    try {
      const { data, error } = await withTimeout(supabase.auth.getUser());
      if (!error && data.user) return { user: data.user };
    } catch {
      // If the backend is briefly unreachable, allow the protected UI to mount
      // from the existing local session instead of leaving the app on a blank loader.
      const { data } = await withTimeout(supabase.auth.getSession());
      if (data.session?.user) return { user: data.session.user };
    }

    const { data } = await withTimeout(supabase.auth.getSession());
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
