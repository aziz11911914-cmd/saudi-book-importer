import { createFileRoute } from "@tanstack/react-router";
import { BarberLayout } from "@/components/barber/barber-layout";

export const Route = createFileRoute("/_authenticated/barber")({
  component: BarberLayout,
});
