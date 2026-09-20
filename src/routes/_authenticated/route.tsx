import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { checkAuthUser } from "@/lib/auth/session.server";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    try {
      const res = await checkAuthUser();
      return { user: res.user };
    } catch {
      throw redirect({ to: "/auth" });
    }
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
