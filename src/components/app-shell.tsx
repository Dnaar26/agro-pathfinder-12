import { ErrorBoundary } from "@/components/error-boundary";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  MapPin, Calendar, Bell, FileBarChart, LogOut, LayoutDashboard, Menu, Shield, Package2, Bot,
  Globe, MapIcon, Leaf, Search, ClipboardList, type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { signOutHttpOnlyCookie } from "@/lib/api/auth.server";
import { EditProfileDialog } from "@/components/profile/edit-profile-dialog";
import { Input } from "@/components/ui/input";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { getMyRoles } from "@/lib/queries";
import { useTranslation } from "react-i18next";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { LANGUAGES } from "@/i18n";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ConnectionBadge } from "@/components/ui/connection-badge";
import { InstallPWA } from "@/components/ui/install-pwa";
import { Logo } from "@/components/logo";

type NavItem = { to: string; labelKey: string; icon: LucideIcon };
type NavGroup = { labelKey: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    labelKey: "nav.group_field",
    items: [
      { to: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
      { to: "/parcels", labelKey: "nav.parcels", icon: MapPin },
      { to: "/cultivos", labelKey: "nav.crops", icon: Leaf },
      { to: "/mapa", labelKey: "nav.map", icon: MapIcon },
    ],
  },
  {
    labelKey: "nav.group_manage",
    items: [
      { to: "/calendar", labelKey: "nav.calendar", icon: Calendar },
      { to: "/inventory", labelKey: "nav.inventory", icon: Package2 },
      { to: "/alerts", labelKey: "nav.alerts", icon: Bell },
    ],
  },
  {
    labelKey: "nav.group_insights",
    items: [
      { to: "/chat", labelKey: "nav.chat", icon: Bot },
      { to: "/reports", labelKey: "nav.reports", icon: FileBarChart },
    ],
  },
];

const ADMIN_GROUP: NavGroup = {
  labelKey: "nav.group_admin",
  items: [
    { to: "/admin", labelKey: "nav.admin", icon: Shield },
    { to: "/audit", labelKey: "nav.audit", icon: ClipboardList },
  ],
};

// Accesos fijos de la barra inferior en teléfono
const TAB_BAR: NavItem[] = [
  { to: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { to: "/parcels", labelKey: "nav.parcels", icon: MapPin },
  { to: "/cultivos", labelKey: "nav.crops", icon: Leaf },
  { to: "/alerts", labelKey: "nav.alerts", icon: Bell },
];

function isActive(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(to + "/");
}

function CountBadge({ count, tone = "warning" }: { count: number; tone?: "warning" | "destructive" }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "grid min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold leading-5 tabular",
        tone === "warning" ? "bg-highlight text-highlight-foreground" : "bg-destructive text-destructive-foreground",
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t, i18n } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const roles = useQuery({ queryKey: ["my-roles"], queryFn: getMyRoles });
  const pendingAlerts = useQuery({
    queryKey: ["pending-alerts-count"],
    queryFn: async () => {
      const { count } = await supabase.from("alerts").select("*", { count: "exact", head: true }).eq("status", "PENDIENTE");
      return count ?? 0;
    },
    refetchInterval: 30000,
  });
  const alertCount = pendingAlerts.data ?? 0;

  const userProfile = useQuery({
    queryKey: ["user-header"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data: p } = await supabase.from("profiles").select("full_name, avatar_url").eq("id", u.user.id).maybeSingle();
      return { email: u.user.email, fullName: p?.full_name || u.user.user_metadata?.full_name, avatarUrl: p?.avatar_url };
    },
  });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const searchResults = useQuery({
    queryKey: ["global-search", debouncedQuery],
    queryFn: async () => {
      const q = debouncedQuery.trim();
      if (!q) return { parcels: [], crops: [] };
      const [parcelsRes, cropsRes] = await Promise.all([
        supabase.from("parcels").select("id, name").ilike("name", `%${q}%`).limit(5),
        // !inner hace que el filtro sobre crop_catalog descarte cultivos sin coincidencia
        supabase.from("crops").select("id, crop_catalog!inner(name), parcels(name)").ilike("crop_catalog.name", `%${q}%`).limit(5),
      ]);
      return { parcels: parcelsRes.data ?? [], crops: cropsRes.data ?? [] };
    },
    enabled: debouncedQuery.trim().length > 0,
  });

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Cierra el menú móvil al navegar
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const userRoles = roles.data ?? [];
  const isAdmin = userRoles.includes("admin");
  const isTecnico = userRoles.includes("tecnico");
  const groups = isAdmin ? [...NAV_GROUPS, ADMIN_GROUP] : NAV_GROUPS;
  const roleLabel = isAdmin ? t("shell.role_admin") : isTecnico ? t("shell.role_tecnico") : t("shell.role_agricultor");
  const displayName = userProfile.data?.fullName ?? userProfile.data?.email ?? "";
  const initial = (displayName || "U").charAt(0).toUpperCase();

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await Promise.allSettled([supabase.auth.signOut(), signOutHttpOnlyCookie()]);
    navigate({ to: "/auth", search: { mode: "login" }, replace: true });
  }

  const closeSearch = () => { setSearchOpen(false); setSearchQuery(""); };

  const sidebarBody = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="px-4 pt-5 pb-4">
        <Link to="/dashboard" aria-label="SIGIC — Inicio">
          <Logo size="sm" variant="light" />
        </Link>
      </div>

      <button
        type="button"
        onClick={() => setEditProfileOpen(true)}
        className="mx-3 mb-3 flex items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-sidebar-accent"
        aria-label={t("shell.edit_profile")}
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sidebar-primary font-display text-sm font-bold text-sidebar-primary-foreground">
          {initial}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{displayName || "…"}</span>
          <span className="block text-xs text-sidebar-foreground/65">{roleLabel}</span>
        </span>
      </button>

      <button
        type="button"
        onClick={() => { setMenuOpen(false); setSearchOpen(true); }}
        className="mx-3 mb-2 flex items-center gap-2 rounded-lg border border-sidebar-border px-3 py-2 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
      >
        <Search className="size-4" aria-hidden="true" />
        <span className="flex-1 text-left">{t("shell.search_button")}</span>
        <kbd className="hidden rounded bg-sidebar-accent px-1.5 py-0.5 font-sans text-[11px] md:inline">Ctrl K</kbd>
      </button>

      <nav aria-label={t("nav.main")} className="flex-1 space-y-5 overflow-y-auto px-3 py-3">
        {groups.map((group) => (
          <div key={group.labelKey}>
            <p className="px-3 pb-1.5 text-xs font-medium text-sidebar-foreground/55">{t(group.labelKey)}</p>
            <ul className="space-y-0.5">
              {group.items.map(({ to, labelKey, icon: Icon }) => {
                const active = isActive(pathname, to);
                return (
                  <li key={to}>
                    <Link
                      to={to}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground before:absolute before:inset-y-2 before:-left-3 before:w-1 before:rounded-r-full before:bg-sidebar-primary"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                      )}
                    >
                      <Icon className="size-[18px] shrink-0" aria-hidden="true" />
                      <span className="flex-1 truncate">{t(labelKey)}</span>
                      {to === "/alerts" && <CountBadge count={alertCount} />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="space-y-3 border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <Select value={i18n.language} onValueChange={(v) => i18n.changeLanguage(v)}>
              <SelectTrigger className="h-9 border-sidebar-border bg-transparent text-xs text-sidebar-foreground" aria-label={t("shell.language")}>
                <Globe className="mr-1 size-3.5" aria-hidden="true" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => (
                  <SelectItem key={l.code} value={l.code} className="text-xs">{l.native}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <InstallPWA />
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-sm text-sidebar-foreground/75 transition-colors hover:bg-destructive/15 hover:text-sidebar-foreground"
        >
          <LogOut className="size-[18px]" aria-hidden="true" />
          {t("nav.sign_out")}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh bg-background">
      {/* Barra lateral (escritorio) */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 border-r border-sidebar-border md:block">
        {sidebarBody}
      </aside>

      {/* Menú completo (teléfono) */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0 [&>button]:text-sidebar-foreground">
          <SheetTitle className="sr-only">{t("nav.main")}</SheetTitle>
          <SheetDescription className="sr-only">{t("shell.open_menu")}</SheetDescription>
          {sidebarBody}
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-background/90 px-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-3 md:hidden">
            <Link to="/dashboard" aria-label="SIGIC — Inicio"><Logo size="xs" showText={false} /></Link>
          </div>
          <div className="hidden items-center gap-2 text-sm text-muted-foreground md:flex">
            <Leaf className="size-4 text-primary" aria-hidden="true" />
            <span className="font-display font-semibold text-foreground">SIGIC</span>
          </div>
          <div className="flex items-center gap-2">
            <ConnectionBadge />
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label={t("shell.search_button")}
              className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground md:hidden"
            >
              <Search className="size-4" aria-hidden="true" />
            </button>
            <Link
              to="/alerts"
              aria-label={`${t("shell.notifications")}${alertCount > 0 ? ` (${alertCount})` : ""}`}
              className="relative grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Bell className="size-4" aria-hidden="true" />
              {alertCount > 0 && (
                <span className="absolute -right-1 -top-1"><CountBadge count={alertCount} tone="destructive" /></span>
              )}
            </Link>
            <ThemeToggle />
          </div>
        </header>

        <main id="contenido" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-28 outline-none md:px-8 md:py-10 md:pb-10">
          <ErrorBoundary message="Ocurri� un error al cargar esta secci�n">{children}</ErrorBoundary>
        </main>
      </div>

      {/* Barra inferior (teléfono) */}
      <nav
        aria-label={t("nav.main")}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="grid grid-cols-5">
          {TAB_BAR.map(({ to, labelKey, icon: Icon }) => {
            const active = isActive(pathname, to);
            return (
              <li key={to}>
                <Link
                  to={to}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <span className="relative">
                    <Icon className="size-5" aria-hidden="true" />
                    {to === "/alerts" && alertCount > 0 && (
                      <span className="absolute -right-2.5 -top-1.5"><CountBadge count={alertCount} /></span>
                    )}
                  </span>
                  <span className="max-w-full truncate px-1">{t(labelKey)}</span>
                  {active && <span aria-hidden="true" className="absolute inset-x-5 top-0 h-0.5 rounded-b-full bg-primary" />}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground"
            >
              <Menu className="size-5" aria-hidden="true" />
              {t("nav.more")}
            </button>
          </li>
        </ul>
      </nav>

      {/* Búsqueda global */}
      <Dialog open={searchOpen} onOpenChange={(v) => { if (v) setSearchOpen(true); else closeSearch(); }}>
        <DialogContent
          className="top-[15%] max-w-lg translate-y-0"
          onOpenAutoFocus={(e) => { e.preventDefault(); searchInputRef.current?.focus(); }}
        >
          <DialogTitle className="sr-only">{t("shell.search_button")}</DialogTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("shell.search_placeholder")}
              aria-label={t("shell.search_placeholder")}
              className="pl-9"
            />
          </div>
          {searchQuery.trim() && (
            <div className="mt-2 max-h-72 space-y-4 overflow-y-auto" aria-live="polite">
              <section>
                <h3 className="px-1 pb-1 font-sans text-xs font-semibold text-muted-foreground">{t("shell.parcels")}</h3>
                {(searchResults.data?.parcels ?? []).length === 0 ? (
                  <p className="px-1 text-sm text-muted-foreground">{t("shell.no_results")}</p>
                ) : (
                  searchResults.data?.parcels.map((p: any) => (
                    <Link key={p.id} to="/parcels/$id" params={{ id: p.id }} onClick={closeSearch} className="flex items-center gap-2 rounded-md p-2 text-sm hover:bg-accent">
                      <MapPin className="size-4 text-primary" aria-hidden="true" />{p.name}
                    </Link>
                  ))
                )}
              </section>
              <section>
                <h3 className="px-1 pb-1 font-sans text-xs font-semibold text-muted-foreground">{t("shell.crops")}</h3>
                {(searchResults.data?.crops ?? []).length === 0 ? (
                  <p className="px-1 text-sm text-muted-foreground">{t("shell.no_results")}</p>
                ) : (
                  searchResults.data?.crops.map((c: any) => (
                    <Link key={c.id} to="/crops/$id" params={{ id: c.id }} onClick={closeSearch} className="flex items-center gap-2 rounded-md p-2 text-sm hover:bg-accent">
                      <Leaf className="size-4 text-primary" aria-hidden="true" />
                      {c.crop_catalog?.name ?? "—"}
                      {c.parcels?.name && <span className="text-xs text-muted-foreground">· {c.parcels.name}</span>}
                    </Link>
                  ))
                )}
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <EditProfileDialog open={editProfileOpen} onOpenChange={setEditProfileOpen} />
    </div>
  );
}
