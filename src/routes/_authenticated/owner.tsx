import { createFileRoute } from "@tanstack/react-router";
import { OwnerLayout } from "@/components/owner/owner-layout";

export const Route = createFileRoute("/_authenticated/owner")({
  component: () => <OwnerLayout />,
});
