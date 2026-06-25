import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/owner/barbers")({
  component: () => (
    <div className="mx-auto max-w-3xl space-y-3 px-2 py-10 text-center">
      <h1 className="font-display text-3xl">Barbers</h1>
      <p className="text-sm text-muted-foreground">
        This module is being built next. The Owner Dashboard is the first delivered section.
      </p>
    </div>
  ),
});
