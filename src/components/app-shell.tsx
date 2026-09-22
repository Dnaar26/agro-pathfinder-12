import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { MapPin, Calendar, Bell, FileBarChart, LogOut, LayoutDashboard, Menu, Shield, Package2, Bot, Globe, MapIcon, Leaf, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { signOutHttpOnlyCookie } from "@/lib/api/auth.server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { getMyRoles, listAlerts } from "@/lib/queries";
import { useTranslation } from "react-i18next";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { LANGUAGES } from "@/i18n";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ConnectionBadge } from "@/components/ui/connection-badge";
import { InstallPWA } from "@/components/ui/install-pwa";
import { Logo } from "@/components/logo";

const baseNav = [
  { to: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { to: "/parcels", labelKey: "nav.parcels", icon: MapPin },
  { to: "/cultivos", labelKey: "nav.crops", icon: Leaf },
  { to: "/mapa", labelKey: "nav.map", icon: MapIcon },
  { to: "/calendar", labelKey: "nav.calendar", icon: Calendar },
  { to: "/inventory", labelKey: "nav.inventory", icon: Package2 },
  { to: "/alerts", labelKey: "nav.alerts", icon: Bell },
  { to: "/chat", labelKey: "nav.chat", icon: Bot },
  { to: "/reports", labelKey: "nav.reports", icon: FileBarChart },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { t, i18n } = useTranslation();
  const roles = useQuery({ queryKey: ["my-roles"], queryFn: getMyRoles });
  const pendingAlerts = useQuery({
    queryKey: ["pending-alerts-count"],
    queryFn: async () => {
      const { count } = await supabase.from("alerts").select("*", { count: "exact", head: true }).eq("status", "PENDIENTE");
      return count ?? 0;
    },
    refetchInterval: 30000,
  });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const searchResults = useQuery({
    queryKey: ["global-search", debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery.trim()) return { parcels: [], crops: [] };
      const q = debouncedQuery.trim().toLowerCase();
      const [parcelsRes, cropsRes] = await Promise.all([
        supabase.from("parcels").select("id, name").ilike("name", `%${q}%`).limit(5),
        supabase.from("crops").select("id, crop_catalog(name), parcels(name)").ilike("crop_catalog.name", `%${q}%`).limit(5),
      ]);
      return { parcels: parcelsRes.data ?? [], crops: cropsRes.data ?? [] };
    },
    enabled: debouncedQuery.trim().length > 0,
  });

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); setSearchOpen(true); }
      if (e.key === "Escape") { setSearchOpen(false); setSearchQuery(""); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => { if (searchOpen) setTimeout(() => searchInputRef.current?.focus(), 100); }, [searchOpen]);

  const userRoles = roles.data ?? [];
  const isAdmin = userRoles.includes("admin");
  const isTecnico = userRoles.includes("tecnico");
  const nav = isAdmin
    ? [...baseNav, { to: "/admin", labelKey: "nav.admin", icon: Shield } as const, { to: "/audit", labelKey: "audit.title", icon: Shield } as const]
    : isTecnico
      ? baseNav
      : baseNav.filter((n) => !["/chat", "/reports"].includes(n.to)); // agricultor: menos ruido

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await Promise.allSettled([
      supabase.auth.signOut(),
      signOutHttpOnlyCookie(),
    ]);
    navigate({ to: "/auth", replace: true });
  }

  const roleBadge = isAdmin ? "Administrador" : (roles.data ?? []).some((r) => r === "tecnico") ? "Técnico" : "Agricultor";

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      <header className="md:hidden flex items-center justify-between border-b border-border px-4 py-3 bg-sidebar">
        <Link to="/dashboard">
          <Logo size="sm" />
        </Link>
        <Button variant="ghost" size="icon" onClick={() => setOpen((v) => !v)}><Menu className="size-5" /></Button>
      </header>

      <aside className={cn(
        "md:w-64 md:flex md:flex-col md:border-r md:border-sidebar-border bg-sidebar text-sidebar-foreground",
        open ? "block" : "hidden md:flex"
      )}>
        <div className="hidden md:flex flex-col px-6 py-5 border-b border-sidebar-border gap-2">
          <Logo />
          <div className="text-xs text-sidebar-foreground/60">{roleBadge}</div>
        </div>
        <nav className="flex-1 p-3 flex flex-col gap-1 overflow-y-auto">
          {nav.map(({ to, labelKey, icon: Icon }) => {
            const active = pathname === to || pathname.startsWith(to + "/");
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60"
                )}
              >
                <Icon className="size-4" /> {t(labelKey)}
                {to === "/alerts" && (pendingAlerts.data ?? 0) > 0 && (
                  <span className="ml-auto size-5 rounded-full bg-warning text-warning-foreground text-[10px] font-bold flex items-center justify-center">{pendingAlerts.data}</span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 pt-1">
          <button onClick={() => setSearchOpen(true)} className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-sidebar-foreground/60 hover:bg-sidebar-accent/60 transition-colors">
            <Search className="size-3.5" /> Buscar… <kbd className="ml-auto text-[10px] px-1 py-0.5 rounded bg-sidebar-accent/50">Ctrl+K</kbd>
          </button>
        </div>
        <div className="p-3 border-t border-sidebar-border space-y-2">
          <div className="flex items-center gap-1">
            <div className="flex-1">
              <Select value={i18n.language} onValueChange={(v) => i18n.changeLanguage(v)}>
                <SelectTrigger className="h-8 text-xs">
                  <Globe className="size-3.5 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.code} value={l.code} className="text-xs">{l.native} ({l.label})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ThemeToggle />
            <InstallPWA />
          </div>
          <div className="flex items-center justify-between">
            <ConnectionBadge />
            <Button variant="ghost" size="sm" className="gap-2" onClick={handleSignOut}>
              <LogOut className="size-4" /> {t("nav.sign_out")}
            </Button>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-10">{children}</div>
      </main>

      {/* Global search dialog */}
      <Dialog open={searchOpen} onOpenChange={(v) => { setSearchOpen(v); if (!v) setSearchQuery(""); }}>
        <DialogContent className="top-[15%] max-w-lg">
          <div className="relative">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input ref={searchInputRef} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar parcelas o cultivos… (Ctrl+K)" className="pl-9" />
          </div>
          {searchQuery.trim() && (
            <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
              <p className="text-xs text-muted-foreground font-medium">Parcelas</p>
              {(searchResults.data?.parcels ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground pl-1">Sin resultados</p>
              ) : (
                searchResults.data?.parcels.map((p: any) => (
                  <Link key={p.id} to="/parcels/$id" params={{ id: p.id }} onClick={() => { setSearchOpen(false); setSearchQuery(""); }} className="block p-2 rounded-md hover:bg-muted text-sm">
                    <MapPin className="size-3 inline mr-1 text-primary" />{p.name}
                  </Link>
                ))
              )}
              <p className="text-xs text-muted-foreground font-medium mt-3">Cultivos</p>
              {(searchResults.data?.crops ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground pl-1">Sin resultados</p>
              ) : (
                searchResults.data?.crops.map((c: any) => (
                  <Link key={c.id} to="/crops/$id" params={{ id: c.id }} onClick={() => { setSearchOpen(false); setSearchQuery(""); }} className="block p-2 rounded-md hover:bg-muted text-sm">
                    <Leaf className="size-3 inline mr-1 text-primary" />{(c as any).crop_catalog?.name ?? "—"} <span className="text-xs text-muted-foreground">— {(c as any).parcels?.name ?? ""}</span>
                  </Link>
                ))
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
