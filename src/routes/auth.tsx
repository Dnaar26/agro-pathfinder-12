import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Eye, EyeOff, Mail, Lock, User, Phone, Sprout, ShieldCheck, CheckCircle2, ArrowRight, Loader2 } from "lucide-react";
import { Logo } from "@/components/logo";
import { requestPasswordReset, validateDomainMx } from "@/lib/api/auth.server";
import { phoneSchema } from "@/lib/schemas/phone";
import { emailSchema } from "@/lib/schemas/email";
import { firstNameSchema, lastNameSchema, validatePasswordSecurity } from "@/lib/schemas/user";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [{ title: "Acceder — SIGIC" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    mode: (s.mode as "login" | "signup") || "login",
  }),
  component: () => <AuthPage />,
});

const loginPasswordSchema = z.string().min(1, "Ingresa tu contraseña").max(72);

export function AuthPage({ initialTab }: { initialTab?: "login" | "signup" } = {}) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"login" | "signup">(() => {
    if (initialTab) return initialTab;
    if (typeof window !== "undefined") {
      const mode = new URLSearchParams(window.location.search).get("mode");
      if (mode === "login" || mode === "signup") return mode;
    }
    return "login";
  });
  const [loading, setLoading] = useState(false);

  // Sync tab if initialTab changes
  useEffect(() => {
    if (initialTab) {
      setTab(initialTab);
    } else if (typeof window !== "undefined") {
      const mode = new URLSearchParams(window.location.search).get("mode");
      if (mode === "login" || mode === "signup") {
        setTab(mode);
      }
    }
  }, [initialTab]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return;
      navigate({ to: "/dashboard", replace: true });
    }).catch(() => {});
  }, [navigate]);

  const [resetEmail, setResetEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [signupPassword, setSignupPassword] = useState("");

  const [signupForm, setSignupForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [signupTouched, setSignupTouched] = useState<Record<string, boolean>>({});
  const [signupErrors, setSignupErrors] = useState<Record<string, string>>({});

  const validateSignupField = (name: string, value: string, current = signupForm) => {
    switch (name) {
      case "firstName": {
        const res = firstNameSchema.safeParse(value.trim());
        return res.success ? "" : res.error.issues[0].message;
      }
      case "lastName": {
        const res = lastNameSchema.safeParse(value.trim());
        return res.success ? "" : res.error.issues[0].message;
      }
      case "phone": {
        const res = phoneSchema.safeParse(value.trim());
        return res.success ? "" : res.error.issues[0].message;
      }
      case "email": {
        const res = emailSchema.safeParse(value.trim().toLowerCase());
        return res.success ? "" : res.error.issues[0].message;
      }
      case "password": {
        const res = validatePasswordSecurity(value, {
          firstName: current.firstName,
          lastName: current.lastName,
          email: current.email,
        });
        return res.valid ? "" : (res.error || "Contraseña inválida");
      }
      case "confirmPassword": {
        if (!value) return "Confirma tu contraseña";
        if (value !== current.password) return "Las contraseñas no coinciden";
        return "";
      }
      default:
        return "";
    }
  };

  const isSignupValid = Boolean(
    signupForm.firstName.trim() &&
    signupForm.lastName.trim() &&
    signupForm.phone.trim() &&
    signupForm.email.trim() &&
    signupForm.password &&
    signupForm.confirmPassword &&
    signupForm.password === signupForm.confirmPassword &&
    firstNameSchema.safeParse(signupForm.firstName.trim()).success &&
    lastNameSchema.safeParse(signupForm.lastName.trim()).success &&
    phoneSchema.safeParse(signupForm.phone.trim()).success &&
    emailSchema.safeParse(signupForm.email.trim().toLowerCase()).success &&
    validatePasswordSecurity(signupForm.password, {
      firstName: signupForm.firstName.trim(),
      lastName: signupForm.lastName.trim(),
      email: signupForm.email.trim().toLowerCase(),
    }).valid
  );

  const handleSignupChange = (field: keyof typeof signupForm, value: string) => {
    const updated = { ...signupForm, [field]: value };
    setSignupForm(updated);

    if (field === "password") {
      setSignupPassword(value);
    }

    if (signupTouched[field]) {
      setSignupErrors((prev) => ({
        ...prev,
        [field]: validateSignupField(field, value, updated),
      }));
    }

    // Co-validación si cambia la contraseña
    if (field === "password" && (signupTouched.confirmPassword || updated.confirmPassword)) {
      setSignupErrors((prev) => ({
        ...prev,
        confirmPassword: validateSignupField("confirmPassword", updated.confirmPassword, updated),
      }));
    }

    // Co-validación si cambia nombre, apellido o correo (afecta contraseña)
    if (["firstName", "lastName", "email"].includes(field) && (signupTouched.password || updated.password)) {
      setSignupErrors((prev) => ({
        ...prev,
        password: validateSignupField("password", updated.password, updated),
      }));
    }
  };

  const handleSignupBlur = (field: keyof typeof signupForm) => {
    setSignupTouched((prev) => ({ ...prev, [field]: true }));
    setSignupErrors((prev) => {
      const err = validateSignupField(field, signupForm[field], signupForm);
      const nextErrors = { ...prev, [field]: err };
      if (field === "password" && (signupTouched.confirmPassword || signupForm.confirmPassword)) {
        nextErrors.confirmPassword = validateSignupField("confirmPassword", signupForm.confirmPassword, signupForm);
      }
      return nextErrors;
    });
  };

  // Password strength calculation
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: "", color: "" };
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[\W_]/.test(pass)) score++;

    if (score <= 1) return { score: 25, label: "Débil", color: "bg-red-500" };
    if (score === 2 || score === 3) return { score: 65, label: "Aceptable", color: "bg-amber-500" };
    return { score: 100, label: "Fuerte", color: "bg-emerald-500" };
  };

  const pwdStrength = getPasswordStrength(signupPassword);

  async function handleResetPassword() {
    const parsed = emailSchema.safeParse(resetEmail);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setLoading(true);
    const cleanEmail = parsed.data.trim().toLowerCase();
    try {
      // 1. Validar existencia del usuario en la base de datos (RPC)
      let exists = false;
      try {
        const { data: hasAccount, error } = await (supabase as any).rpc("check_email_exists", {
          p_email: cleanEmail,
        });
        if (!error && hasAccount === true) {
          exists = true;
        }
      } catch (err) {
        console.warn("RPC check_email_exists:", err);
      }

      // 2. Solo despacha si el correo realmente existe
      if (exists) {
        await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
      }
    } catch (e) {
      console.warn("Error en recuperación de contraseña:", e);
    } finally {
      setLoading(false);
      // Responder SIEMPRE con mensaje neutral uniforme
      toast.success("Si el correo está registrado, recibirás un código de recuperación.");
      setResetEmail("");
    }
  }

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const rawEmail = ((fd.get("email") as string) || "").trim().toLowerCase();
    const rawPassword = (fd.get("password") as string) || "";
    const email = emailSchema.safeParse(rawEmail);
    const password = loginPasswordSchema.safeParse(rawPassword);

    if (!email.success) return toast.error(email.error.issues[0].message);
    if (!password.success) return toast.error(password.error.issues[0].message);

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.data,
        password: password.data,
      });

      if (error) {
        toast.error(error.message === "Invalid login credentials" ? "Correo o contraseña incorrectos" : error.message);
        return;
      }

      if (data.session) {
        toast.success("¡Bienvenido a SIGIC!");
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error de conexión al servidor.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setSignupTouched({
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      password: true,
      confirmPassword: true,
    });

    const fNameErr = validateSignupField("firstName", signupForm.firstName);
    const lNameErr = validateSignupField("lastName", signupForm.lastName);
    const phoneErr = validateSignupField("phone", signupForm.phone);
    const emailErr = validateSignupField("email", signupForm.email);
    const passErr = validateSignupField("password", signupForm.password);
    const confirmErr = validateSignupField("confirmPassword", signupForm.confirmPassword);

    const newErrors = {
      firstName: fNameErr,
      lastName: lNameErr,
      phone: phoneErr,
      email: emailErr,
      password: passErr,
      confirmPassword: confirmErr,
    };
    setSignupErrors(newErrors);

    if (fNameErr || lNameErr || phoneErr || emailErr || passErr || confirmErr || !isSignupValid) {
      const firstError = fNameErr || lNameErr || phoneErr || emailErr || passErr || confirmErr;
      if (firstError) toast.error(firstError);
      return;
    }

    const cleanEmail = signupForm.email.trim().toLowerCase();
    const cleanFirstName = signupForm.firstName.trim();
    const cleanLastName = signupForm.lastName.trim();
    const cleanPhone = signupForm.phone.trim();
    const fullName = `${cleanFirstName} ${cleanLastName}`;

    setLoading(true);
    try {
      // 0. Validación MX del dominio del correo en el servidor
      try {
        await validateDomainMx({ data: { email: cleanEmail } });
      } catch (mxErr: any) {
        const msg = mxErr?.message || "";
        if (msg.includes("dominio") || msg.includes("correo") || msg.includes("existe") || msg.includes("escribir")) {
          setSignupErrors((prev) => ({ ...prev, email: msg }));
          toast.error(msg);
          return;
        }
        console.warn("Aviso en validación MX:", mxErr);
      }

      // 1. Pre-verificación RPC para comprobar si el correo ya existe
      try {
        const { data: exists } = await (supabase as any).rpc("check_email_exists", {
          p_email: cleanEmail,
        });
        if (exists === true) {
          setSignupErrors((prev) => ({ ...prev, email: "Este correo ya está en uso" }));
          toast.error("Este correo ya está en uso");
          return;
        }
      } catch {
        // En caso de que la función SQL no esté creada aún en la base de datos, continúa con la verificación de Supabase Auth
      }

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: signupForm.password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            full_name: fullName,
            first_name: cleanFirstName,
            last_name: cleanLastName,
            phone: cleanPhone,
          },
        },
      });

      if (error) {
        const msg = error.message.toLowerCase();
        if (
          msg.includes("already registered") ||
          msg.includes("already exists") ||
          msg.includes("ya está registrado") ||
          msg.includes("unique constraint")
        ) {
          setSignupErrors((prev) => ({ ...prev, email: "Este correo ya está en uso" }));
          toast.error("Este correo ya está en uso");
          return;
        }
        toast.error(error.message);
        return;
      }

      // Supabase retorna identities = [] cuando el correo ya existe y la confirmación de email está activa
      if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        setSignupErrors((prev) => ({ ...prev, email: "Este correo ya está en uso" }));
        toast.error("Este correo ya está en uso");
        return;
      }

      if (data.user && data.session) {
        try {
          const { error: profileError } = await (supabase as any).from("profiles").upsert({
            id: data.user.id,
            full_name: fullName,
            phone: cleanPhone,
            updated_at: new Date().toISOString(),
          });
          if (profileError) {
            console.warn("Aviso al sincronizar perfil tras registro:", profileError.message);
          }
        } catch (profileErr) {
          console.warn("Error secundario al actualizar perfil:", profileErr);
        }
      }

      if (!data?.session) {
        toast.success("¡Registro exitoso! Revisa tu correo electrónico para confirmar tu cuenta.");
        setTab("login");
        return;
      }

      toast.success("¡Cuenta creada exitosamente!");
      navigate({ to: "/dashboard", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error de conexión.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Banner Izquierdo */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-emerald-900 via-emerald-800 to-green-950 text-white relative overflow-hidden">
        <div className="absolute -right-20 -top-20 size-96 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 size-96 rounded-full bg-green-400/10 blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <Link to="/">
            <Logo size="lg" variant="light" />
          </Link>
        </div>

        <div className="relative z-10 max-w-lg space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-medium backdrop-blur-md border border-white/15">
            <Sprout className="size-3.5 text-emerald-300" />
            <span>Sistema Agrícola Inteligente</span>
          </div>

          <h2 className="text-4xl font-bold leading-tight tracking-tight">
            Control total de tus cultivos en un solo lugar.
          </h2>

          <p className="text-emerald-100/80 text-sm leading-relaxed">
            Administra tus parcelas, optimiza insumos, recibe alertas agroclimáticas oportunas y toma decisiones fundamentadas con IA.
          </p>

          <div className="space-y-3 pt-2">
            {[
              "Diagnósticos y recomendaciones inteligentes por IA",
              "Control riguroso de inventarios y finanzas",
              "Acceso continuo y trabajo sin conexión a internet",
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-2.5 text-xs text-emerald-100/90 font-medium">
                <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between text-xs text-emerald-200/60 border-t border-white/10 pt-4">
          <span>© SIGIC — Gestión Inteligente de Cultivos</span>
          <div className="flex items-center gap-1">
            <ShieldCheck className="size-3.5 text-emerald-400" />
            <span>Conexión Encriptada SSL</span>
          </div>
        </div>
      </div>

      {/* Formulario Derecho */}
      <div className="flex items-center justify-center p-6 md:p-12 bg-card">
        <div className="w-full max-w-md space-y-6">
          <div className="lg:hidden flex justify-center mb-4">
            <Link to="/">
              <Logo size="sm" />
            </Link>
          </div>

          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {tab === "login" ? "Bienvenido de nuevo" : "Crear tu cuenta agrícola"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {tab === "login"
                ? "Ingresa tus credenciales para acceder al panel de gestión"
                : "Completa tus datos personales para registrarte en la plataforma"}
            </p>
          </div>

          <Tabs value={tab} onValueChange={(val) => setTab(val as "login" | "signup")} className="w-full">
            <TabsList className="grid grid-cols-2 w-full h-11 bg-muted p-1 rounded-xl">
              <TabsTrigger value="login" className="rounded-lg text-xs font-semibold transition-all">
                Iniciar Sesión
              </TabsTrigger>
              <TabsTrigger value="signup" className="rounded-lg text-xs font-semibold transition-all">
                Crear Cuenta
              </TabsTrigger>
            </TabsList>

            {/* FORMULARIO INICIAR SESIÓN */}
            <TabsContent value="login" className="space-y-4 mt-6">
              <form onSubmit={handleLogin} noValidate className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-medium">Correo Electrónico</Label>
                  <div className="relative">
                    <Mail className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="ejemplo@agrifarm.com"
                      autoComplete="email"
                      required
                      className="pl-9 text-sm h-10"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs font-medium">Contraseña</Label>
                  <div className="relative">
                    <Lock className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      required
                      className="pl-9 pr-10 text-sm h-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" className="w-full h-10 text-sm font-semibold gap-2 mt-2" disabled={loading}>
                  {loading ? <Loader2 className="size-4 animate-spin" /> : null}
                  {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
                  {!loading && <ArrowRight className="size-4" />}
                </Button>
              </form>

              <div className="pt-2">
                <details className="group text-center">
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-primary transition-colors select-none">
                    ¿Olvidaste tu contraseña?
                  </summary>
                  <div className="mt-3 p-3 rounded-lg border border-border bg-muted/40 space-y-2 text-left">
                    <Label htmlFor="reset-email" className="text-[11px]">Ingresa tu correo para enviarte un enlace de recuperación</Label>
                    <div className="flex gap-2">
                      <Input
                        id="reset-email"
                        type="email"
                        placeholder="tu@correo.com"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        className="text-xs h-8"
                      />
                      <Button type="button" size="sm" className="h-8 text-xs shrink-0" disabled={loading} onClick={handleResetPassword}>
                        Enviar
                      </Button>
                    </div>
                  </div>
                </details>
              </div>

            </TabsContent>

            {/* FORMULARIO CREAR CUENTA */}
            <TabsContent value="signup" className="space-y-4 mt-6">
              <form onSubmit={handleSignup} noValidate className="space-y-3.5">
                {/* Nombre y Apellido separados */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="first_name" className="text-xs font-medium">Nombre</Label>
                    <div className="relative">
                      <User className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="first_name"
                        name="first_name"
                        placeholder="Juan"
                        value={signupForm.firstName}
                        onChange={(e) => handleSignupChange("firstName", e.target.value)}
                        onBlur={() => handleSignupBlur("firstName")}
                        required
                        className={`pl-9 text-sm h-10 ${signupTouched.firstName && signupErrors.firstName ? "border-destructive focus-visible:ring-destructive" : ""}`}
                      />
                    </div>
                    {signupTouched.firstName && signupErrors.firstName && (
                      <p className="text-xs text-destructive mt-1 font-medium">{signupErrors.firstName}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="last_name" className="text-xs font-medium">Apellido</Label>
                    <Input
                      id="last_name"
                      name="last_name"
                      placeholder="Pérez"
                      value={signupForm.lastName}
                      onChange={(e) => handleSignupChange("lastName", e.target.value)}
                      onBlur={() => handleSignupBlur("lastName")}
                      required
                      className={`px-3 text-sm h-10 ${signupTouched.lastName && signupErrors.lastName ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    />
                    {signupTouched.lastName && signupErrors.lastName && (
                      <p className="text-xs text-destructive mt-1 font-medium">{signupErrors.lastName}</p>
                    )}
                  </div>
                </div>

                {/* Teléfono */}
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-xs font-medium">Número de Teléfono</Label>
                  <div className="relative">
                    <Phone className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      placeholder="3001234567 o +573001234567"
                      value={signupForm.phone}
                      onChange={(e) => handleSignupChange("phone", e.target.value)}
                      onBlur={() => handleSignupBlur("phone")}
                      required
                      className={`pl-9 text-sm h-10 ${signupTouched.phone && signupErrors.phone ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    />
                  </div>
                  {signupTouched.phone && signupErrors.phone && (
                    <p className="text-xs text-destructive mt-1 font-medium">{signupErrors.phone}</p>
                  )}
                </div>

                {/* Correo Electrónico */}
                <div className="space-y-1.5">
                  <Label htmlFor="email2" className="text-xs font-medium">Correo Electrónico</Label>
                  <div className="relative">
                    <Mail className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email2"
                      name="email"
                      type="email"
                      placeholder="juan.perez@agrifarm.com"
                      autoComplete="email"
                      value={signupForm.email}
                      onChange={(e) => handleSignupChange("email", e.target.value)}
                      onBlur={() => handleSignupBlur("email")}
                      required
                      className={`pl-9 text-sm h-10 ${signupTouched.email && signupErrors.email ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    />
                  </div>
                  {signupTouched.email && signupErrors.email && (
                    <p className="text-xs text-destructive mt-1 font-medium">{signupErrors.email}</p>
                  )}
                </div>

                {/* Contraseña */}
                <div className="space-y-1.5">
                  <Label htmlFor="password2" className="text-xs font-medium">Contraseña</Label>
                  <div className="relative">
                    <Lock className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password2"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={signupForm.password}
                      onChange={(e) => handleSignupChange("password", e.target.value)}
                      onBlur={() => handleSignupBlur("password")}
                      autoComplete="new-password"
                      required
                      className={`pl-9 pr-10 text-sm h-10 ${signupTouched.password && signupErrors.password ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {signupTouched.password && signupErrors.password && (
                    <p className="text-xs text-destructive mt-1 font-medium">{signupErrors.password}</p>
                  )}
                  {signupPassword && (
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-muted-foreground">Fortaleza de contraseña:</span>
                        <span className="font-semibold">{pwdStrength.label}</span>
                      </div>
                      <div className="w-full bg-muted h-1 rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-300 ${pwdStrength.color}`} style={{ width: `${pwdStrength.score}%` }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirmar Contraseña */}
                <div className="space-y-1.5">
                  <Label htmlFor="confirm_password" className="text-xs font-medium">Confirmar Contraseña</Label>
                  <div className="relative">
                    <Lock className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="confirm_password"
                      name="confirm_password"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={signupForm.confirmPassword}
                      onChange={(e) => handleSignupChange("confirmPassword", e.target.value)}
                      onBlur={() => handleSignupBlur("confirmPassword")}
                      autoComplete="new-password"
                      required
                      className={`pl-9 pr-10 text-sm h-10 ${signupTouched.confirmPassword && signupErrors.confirmPassword ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {signupTouched.confirmPassword && signupErrors.confirmPassword && (
                    <p className="text-xs text-destructive mt-1 font-medium">{signupErrors.confirmPassword}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full h-10 text-sm font-semibold gap-2 mt-3"
                  disabled={loading || !isSignupValid}
                >
                  {loading ? <Loader2 className="size-4 animate-spin" /> : null}
                  {loading ? "Creando cuenta..." : "Registrar Cuenta"}
                  {!loading && <ArrowRight className="size-4" />}
                </Button>
              </form>

            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
