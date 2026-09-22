import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Logo } from "@/components/logo";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({ meta: [{ title: "Nueva contraseña — SIGIC" }] }),
  component: ResetPasswordPage,
});

const passwordSchema = z
  .string()
  .min(8, "Mínimo 8 caracteres")
  .max(72)
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, "Usa mayúscula, minúscula y número");

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Supabase sends the recovery token as a hash fragment (#access_token=...&type=recovery).
  // The JS client picks it up automatically via onAuthStateChange.
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });

    // If the user lands here already authenticated with a recovery session
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = passwordSchema.safeParse(fd.get("password"));
    const confirm = fd.get("confirm_password") as string;

    if (!password.success) return toast.error(password.error.issues[0].message);
    if (password.data !== confirm) return toast.error("Las contraseñas no coinciden");

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: password.data });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Contraseña actualizada correctamente");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background relative">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-primary text-primary-foreground">
        <Link to="/">
          <Logo size="lg" variant="light" />
        </Link>
        <div className="max-w-md">
          <h2 className="font-display text-4xl font-bold leading-tight">
            Tu campo, organizado.
          </h2>
          <p className="mt-4 text-primary-foreground/85">
            Registra parcelas, cultivos y actividades. Recibe alertas oportunas y trabaja incluso sin conexión.
          </p>
        </div>
        <div className="text-xs text-primary-foreground/60">© SIGIC</div>
      </div>

      {/* Right panel */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <Link to="/" className="lg:hidden inline-flex mb-8">
            <Logo size="sm" />
          </Link>

          <h1 className="text-2xl font-bold">Nueva contraseña</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Elige una contraseña segura para tu cuenta.
          </p>

          {!ready ? (
            <div className="mt-8 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              Enlace inválido o expirado.{" "}
              <Link to="/auth" className="underline underline-offset-2">
                Solicita uno nuevo
              </Link>
              .
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-4 mt-6">
              <div className="space-y-2">
                <Label htmlFor="password">Nueva contraseña</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  placeholder="Mínimo 8 caracteres"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm_password">Confirmar contraseña</Label>
                <Input
                  id="confirm_password"
                  name="confirm_password"
                  type="password"
                  autoComplete="new-password"
                  required
                  placeholder="Repite la contraseña"
                />
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Guardando…" : "Guardar contraseña"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                <Link to="/auth" className="underline underline-offset-2">
                  Volver al inicio de sesión
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
