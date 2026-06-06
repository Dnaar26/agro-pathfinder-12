import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listAllUsersWithRoles,
  assignRole,
  revokeRole,
  getMyRoles,
  type AdminUserRow,
} from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, UserCog, X } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";

const ROLES = ["agricultor", "tecnico", "admin"] as const;
type AppRole = (typeof ROLES)[number];

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Administración — SGIC" }] }),
  beforeLoad: async () => {
    const roles = await getMyRoles();
    if (!roles.includes("admin")) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AdminPage,
});

function AdminPage() {
  const qc = useQueryClient();
  const users = useQuery({ queryKey: ["admin-users"], queryFn: listAllUsersWithRoles });

  const assign = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: AppRole }) => assignRole(userId, role),
    onSuccess: () => {
      toast.success("Rol asignado");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const revoke = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: AppRole }) => revokeRole(userId, role),
    onSuccess: () => {
      toast.success("Rol revocado");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
          <Shield className="size-5" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Administración</h1>
          <p className="text-sm text-muted-foreground">Gestiona roles de usuarios del sistema.</p>
        </div>
      </header>

      <section className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <UserCog className="size-4 text-primary" />
          <h2 className="font-semibold">Usuarios ({users.data?.length ?? 0})</h2>
        </div>
        {users.isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Cargando…</p>
        ) : (users.data?.length ?? 0) === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No hay usuarios registrados aún.</p>
        ) : (
          <ul className="divide-y divide-border">
            {users.data!.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                onAssign={(role) => assign.mutate({ userId: u.id, role })}
                onRevoke={(role) => revoke.mutate({ userId: u.id, role })}
                busy={assign.isPending || revoke.isPending}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function UserRow({
  user,
  onAssign,
  onRevoke,
  busy,
}: {
  user: AdminUserRow;
  onAssign: (role: AppRole) => void;
  onRevoke: (role: AppRole) => void;
  busy: boolean;
}) {
  const available = ROLES.filter((r) => !user.roles.includes(r));
  const [pending, setPending] = useState<AppRole | "">("");

  return (
    <li className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <p className="font-medium">{user.full_name || "(sin nombre)"}</p>
        <p className="text-xs text-muted-foreground font-mono mt-0.5">{user.id}</p>
        <div className="flex flex-wrap gap-1 mt-2">
          {user.roles.length === 0 && (
            <span className="text-xs text-muted-foreground italic">Sin roles</span>
          )}
          {user.roles.map((r) => (
            <Badge key={r} variant="secondary" className="gap-1">
              {r}
              <button
                disabled={busy}
                onClick={() => onRevoke(r as AppRole)}
                className="hover:text-destructive"
                aria-label={`Revocar ${r}`}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Select value={pending} onValueChange={(v) => setPending(v as AppRole)}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Asignar rol…" />
          </SelectTrigger>
          <SelectContent>
            {available.length === 0 && (
              <SelectItem value="__none__" disabled>Sin roles disponibles</SelectItem>
            )}
            {available.map((r) => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          disabled={busy || !pending}
          onClick={() => { if (pending) { onAssign(pending); setPending(""); } }}
        >
          Asignar
        </Button>
      </div>
    </li>
  );
}
