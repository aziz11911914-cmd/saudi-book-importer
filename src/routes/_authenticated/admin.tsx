import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/admin-layout";

export const Route = createFileRoute("/_authenticated/admin")({
  component: () => <AdminLayout><Outlet /></AdminLayout>,
});
