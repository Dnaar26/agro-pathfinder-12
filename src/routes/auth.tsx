import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { signInWithHttpOnlyCookie, signUpWithHttpOnlyCookie } from "@/lib/api/auth.server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Logo } from "@/components/logo";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [{ title: "Acceder — SIGIC" }] }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Correo inválido").max(180);
const loginPasswordSchema = z.string().min(1, "Ingresa tu contraseña").max(72);
const signupPasswordSchema = z
  .string()
  .min(8, "Mínimo 8 caracteres")
  .max(72)
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/, "Usa mayúscula, minúscula, número y carácter especial");
const nameSchema = z.string().trim().min(2, "Nombre muy corto").max(120);



function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      navigate({ to: "/dashboard", replace: true });
    }).catch(() => {});
  }, [navigate]);

  const [resetEmail, setResetEmail] = useState("");



  async function handleResetPassword() {
    const parsed = emailSchema.safeParse(resetEmail);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, { redirectTo: `${window.location.origin}/reset-password` });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Revisa tu correo para restablecer la contraseña");
    setResetEmail("");
  }

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = emailSchema.safeParse(fd.get("email"));
    const password = loginPasswordSchema.safeParse(fd.get("password"));
    if (!email.success) return toast.error(email.error.issues[0].message);
    if (!password.success) return toast.error(password.error.issues[0].message);
    setLoading(true);
    try {
      await signInWithHttpOnlyCookie({ data: { email: email.data, password: password.data } });
      navigate({ to: "/dashboard", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error de conexión.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = nameSchema.safeParse(fd.get("full_name"));
    const email = emailSchema.safeParse(fd.get("email"));
    const password = signupPasswordSchema.safeParse(fd.get("password"));
    const confirmPassword = fd.get("confirm_password");
    if (!name.success) return toast.error(name.error.issues[0].message);
    if (!email.success) return toast.error(email.error.issues[0].message);
    if (!password.success) return toast.error(password.error.issues[0].message);
    if (password.data !== confirmPassword) return toast.error("Las contraseñas no coinciden");
    setLoading(true);
    try {
      const res = await signUpWithHttpOnlyCookie({
        data: {
          email: email.data,
          password: password.data,
          fullName: name.data,
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (res.needsEmailConfirmation) {
        toast.success("Cuenta creada. Revisa tu correo para confirmar el acceso.");
        return;
      }
      toast.success("Cuenta creada.");
      navigate({ to: "/dashboard", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error de conexión.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background relative">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
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

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <Link to="/" className="lg:hidden inline-flex mb-8">
            <Logo size="sm" />
          </Link>
          <h1 className="text-2xl font-bold">Bienvenido</h1>
          <p className="text-sm text-muted-foreground mt-1">Accede para gestionar tus cultivos.</p>

          <Tabs defaultValue="login" className="mt-6">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="login">Iniciar sesión</TabsTrigger>
              <TabsTrigger value="signup">Crear cuenta</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} noValidate className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Correo</Label>
                  <Input id="email" name="email" type="email" autoComplete="email" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input id="password" name="password" type="password" autoComplete="current-password" required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>Entrar</Button>
                <details className="text-center">
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">¿Olvidaste tu contraseña?</summary>
                  <div className="mt-2 flex gap-2">
                    <Input type="email" placeholder="Tu correo" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} className="text-sm" required />
                    <Button type="button" size="sm" disabled={loading} onClick={handleResetPassword}>Enviar</Button>
                  </div>
                </details>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} noValidate className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Nombre completo</Label>
                  <Input id="full_name" name="full_name" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email2">Correo</Label>
                  <Input id="email2" name="email" type="email" autoComplete="email" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password2">Contraseña</Label>
                  <Input id="password2" name="password" type="password" autoComplete="new-password" required />
                  <p className="text-xs text-muted-foreground">Mínimo 8 caracteres, con mayúscula, minúscula, número y carácter especial.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm_password">Confirmar contraseña</Label>
                  <Input id="confirm_password" name="confirm_password" type="password" autoComplete="new-password" required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>Crear cuenta</Button>
              </form>
            </TabsContent>
          </Tabs>



        </div>
      </div>
    </div>
  );
}
