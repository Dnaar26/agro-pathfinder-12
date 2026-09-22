import { useQuery } from "@tanstack/react-query";
import { getMyRoles } from "@/lib/queries";
import type { ReactNode } from "react";

export function RoleGate({ roles, fallback = null, children }: { roles: string[]; fallback?: ReactNode; children: ReactNode }) {
  const q = useQuery({ queryKey: ["my-roles"], queryFn: getMyRoles });
  const hasAccess = (q.data ?? []).some((r) => roles.includes(r));
  if (hasAccess) return <>{children}</>;
  return <>{fallback}</>;
}

export function useHasRole(...roles: string[]) {
  const q = useQuery({ queryKey: ["my-roles"], queryFn: getMyRoles });
  return (q.data ?? []).some((r) => roles.includes(r));
}
