import { createFileRoute, Link } from "@tanstack/react-router";
import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoIcon } from "@/components/logo";

export const Route = createFileRoute("/offline")({
  head: () => ({ meta: [{ title: "Sin conexión — SIGIC" }] }),
  component: OfflinePage,
});

function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-background">
      <div className="size-16 rounded-2xl bg-muted grid place-items-center mb-6">
        <WifiOff className="size-8 text-muted-foreground" />
      </div>
      <h1 className="text-2xl font-bold">Sin conexión a internet</h1>
      <p className="text-muted-foreground mt-2 max-w-md">
        No te preocupes — tus datos están seguros. Los cambios que hagas se sincronizarán automáticamente cuando vuelvas a estar en línea.
      </p>
      <div className="flex items-center gap-2 mt-8 text-sm text-muted-foreground">
        <LogoIcon size="xs" /> SIGIC — Modo offline
      </div>
      <Button asChild className="mt-4" onClick={() => window.location.reload()}>
        <Link to="/">Reintentar conexión</Link>
      </Button>
    </div>
  );
}
