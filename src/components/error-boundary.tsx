import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  children: ReactNode;
  /** Mensaje personalizado que se muestra al usuario. */
  message?: string;
  /** Si es true, ocupa toda la pantalla (para rutas completas). */
  fullPage?: boolean;
  /** Callback opcional cuando se captura un error. */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  error: Error | null;
}

/**
 * ErrorBoundary de propósito general.
 * Úsalo alrededor de widgets o secciones del dashboard para que un fallo
 * aislado no tire toda la página.
 *
 * @example
 * <ErrorBoundary message="No se pudo cargar el mapa">
 *   <ParcelMap ... />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Registrar en consola para depuración; en producción podrías enviar a Sentry.
    console.error("[ErrorBoundary]", error, info.componentStack);
    this.props.onError?.(error, info);
  }

  private reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    const { children, message, fullPage } = this.props;

    if (!error) return children;

    return (
      <div
        role="alert"
        className={cn(
          "flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card p-8 text-center",
          fullPage && "min-h-[60vh]",
        )}
      >
        <span className="grid size-12 place-items-center rounded-full bg-destructive/10">
          <AlertTriangle className="size-6 text-destructive" aria-hidden="true" />
        </span>
        <div className="space-y-1">
          <p className="font-semibold text-foreground">
            {message ?? "Ocurrió un error inesperado"}
          </p>
          <p className="text-sm text-muted-foreground max-w-xs">
            {error.message || "El componente no se pudo cargar."}
          </p>
        </div>
        <button
          type="button"
          onClick={this.reset}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Reintentar
        </button>
      </div>
    );
  }
}

/**
 * Variante de pantalla completa para usar en páginas/rutas.
 * Muestra un mensaje más amigable con botón de recarga.
 */
export class RouteErrorBoundary extends Component<Omit<Props, "fullPage">, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[RouteErrorBoundary]", error, info.componentStack);
    this.props.onError?.(error, info);
  }

  render() {
    const { error } = this.state;
    const { children, message } = this.props;

    if (!error) return children;

    return (
      <main
        role="alert"
        tabIndex={-1}
        id="contenido"
        className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center"
      >
        <span className="grid size-16 place-items-center rounded-2xl bg-destructive/10">
          <AlertTriangle className="size-8 text-destructive" aria-hidden="true" />
        </span>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">
            {message ?? "Algo salió mal"}
          </h1>
          <p className="max-w-md text-muted-foreground">
            La página no se pudo cargar. Puedes intentar recargarla o volver al inicio.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Recargar página
          </button>
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
          >
            Ir al inicio
          </a>
        </div>
      </main>
    );
  }
}
