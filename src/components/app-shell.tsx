import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Sprout, MapPin, Calendar, Bell, FileBarChart, LogOut, LayoutDashboard, Menu, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { getMyRoles } from "@/lib/queries";

const baseNav = [
  { to: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  { to: "/parcels", label: "Parcelas", icon: MapPin },
  { to: "/calendar", label: "Calendario", icon: Calendar },
  { to: "/alerts", label: "Alertas", icon: Bell },
  { to: "/reports", label: "Reportes", icon: FileBarChart },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const roles = useQuery({ queryKey: ["my-roles"], queryFn: getMyRoles });

  const isStaff = (roles.data ?? []).some((r) => r === "tecnico" || r === "admin");
  const isAdmin = (roles.data ?? []).includes("admin");
  const nav = isAdmin
    ? [...baseNav, { to: "/admin", label: "Administración", icon: Shield } as const]
    : baseNav;

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const roleBadge = isAdmin ? "Administrador" : isStaff ? "Técnico" : "Agricultor";

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      <header className="md:hidden flex items-center justify-between border-b border-border px-4 py-3 bg-sidebar">
        <Link to="/dashboard" className="flex items-center gap-2 font-display font-bold text-lg text-primary">
          <Sprout className="size-5" /> SGIC
        </Link>
        <Button variant="ghost" size="icon" onClick={() => setOpen((v) => !v)}><Menu className="size-5" /></Button>
      </header>

      <aside className={cn(
        "md:w-64 md:flex md:flex-col md:border-r md:border-sidebar-border bg-sidebar text-sidebar-foreground",
        open ? "block" : "hidden md:flex"
      )}>
        <div className="hidden md:flex items-center gap-2 px-6 py-5 border-b border-sidebar-border">
          <div className="size-9 rounded-lg bg-primary text-primary-foreground grid place-items-center">
            <Sprout className="size-5" />
          </div>
          <div>
            <div className="font-display font-bold leading-none">SGIC</div>
            <div className="text-xs text-muted-foreground mt-0.5">{roleBadge}</div>
          </div>
        </div>
        <nav className="flex-1 p-3 flex flex-col gap-1">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = pathname === to || pathname.startsWith(to + "/");
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60"
                )}
              >
                <Icon className="size-4" /> {label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <Button variant="ghost" className="w-full justify-start gap-2" onClick={handleSignOut}>
            <LogOut className="size-4" /> Cerrar sesión
          </Button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-10">{children}</div>
      </main>
    </div>
  );
}
