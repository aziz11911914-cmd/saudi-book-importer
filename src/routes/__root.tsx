import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { LocaleProvider } from "@/lib/locale-provider";
import { AuthProvider } from "@/lib/auth-provider";
import { supabase } from "@/integrations/supabase/client";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl text-gold">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-gold-glow"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-2xl text-foreground">
          This page didn&apos;t load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-gold-glow"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-hairline px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-gold/50"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0B0B0D" },
      { title: "Qassah — Premium barbers in Saudi Arabia" },
      {
        name: "description",
        content:
          "Discover Saudi Arabia's best barbers, browse their portfolios, and book your next cut in one tap.",
      },
      { property: "og:title", content: "Qassah — Premium barbers in Saudi Arabia" },
      {
        property: "og:description",
        content:
          "Discover Saudi Arabia's best barbers, browse their portfolios, and book your next cut in one tap.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Qassah — Premium barbers in Saudi Arabia" },
      { name: "description", content: "Saudi Style Hub is a premium online marketplace for discovering barbers, booking appointments, and managing barbershops in Saudi Arabia." },
      { property: "og:description", content: "Saudi Style Hub is a premium online marketplace for discovering barbers, booking appointments, and managing barbershops in Saudi Arabia." },
      { name: "twitter:description", content: "Saudi Style Hub is a premium online marketplace for discovering barbers, booking appointments, and managing barbershops in Saudi Arabia." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/73a5ca79-342f-4ab8-bbc9-fadc7dc5c412/id-preview-1b884b50--7233233b-fcf2-4dd8-9557-eecd59513f43.lovable.app-1782262184953.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/73a5ca79-342f-4ab8-bbc9-fadc7dc5c412/id-preview-1b884b50--7233233b-fcf2-4dd8-9557-eecd59513f43.lovable.app-1782262184953.png" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="bg-background text-foreground">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>
        <AuthProvider>
          <Outlet />
        </AuthProvider>
      </LocaleProvider>
    </QueryClientProvider>
  );
}
