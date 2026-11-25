import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { User, Phone, Mail, Shield, Loader2, Save, Camera, BellRing } from "lucide-react";
import { phoneSchema } from "@/lib/schemas/phone";
import { compressImageFileToDataUrl } from "@/lib/org-branding";
import {
  requestNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
  showLocalNotification,
} from "@/lib/services/push-notifications";

interface EditProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditProfileDialog({ open, onOpenChange }: EditProfileDialogProps) {
  const qc = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [pushEnabled, setPushEnabled] = useState<boolean>(false);
  const [pushBusy, setPushBusy] = useState<boolean>(false);
  const [touched, setTouched] = useState<{ name?: boolean; phone?: boolean }>({});
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});

  const validatePhone = (val: string) => {
    const res = phoneSchema.safeParse(val.trim());
    return res.success ? "" : res.error.issues[0].message;
  };

  const validateName = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return "El nombre es obligatorio";
    if (trimmed.length < 2) return "El nombre debe tener al menos 2 caracteres";
    if (trimmed.length > 60) return "El nombre no puede exceder 60 caracteres";
    if (!/^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]+(?:\s+[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]+)*$/.test(trimmed)) {
      return "El nombre solo puede contener letras y espacios";
    }
    return "";
  };

  const isFormValid = !validateName(fullName) && !validatePhone(phone);

  const userQuery = useQuery({
    queryKey: ["edit-profile-data"],
    queryFn: async () => {
      const { data: s } = await supabase.auth.getSession();
      const user = s.session?.user ?? (await supabase.auth.getUser()).data.user;
      if (!user) return null;
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name, phone, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      return {
        id: user.id,
        email: user.email,
        fullName: p?.full_name ?? (user.user_metadata?.full_name || ""),
        phone: p?.phone ?? (user.user_metadata?.phone || ""),
        avatarUrl: p?.avatar_url ?? "",
        roles: (roles ?? []).map((r: any) => r.role),
      };
    },
    enabled: open,
  });

  useEffect(() => {
    if (userQuery.data) {
      setFullName(userQuery.data.fullName);
      setPhone(userQuery.data.phone);
      setAvatarUrl(userQuery.data.avatarUrl || "");
      setTouched({});
      setErrors({});
    }
    if (open && typeof window !== "undefined" && "Notification" in window) {
      setPushEnabled(Notification.permission === "granted");
    }
  }, [userQuery.data, open]);

  const handleTogglePush = async (checked: boolean) => {
    setPushBusy(true);
    try {
      if (checked) {
        const granted = await requestNotificationPermission();
        if (!granted) {
          toast.error("Debes permitir las notificaciones en tu navegador.");
          setPushEnabled(false);
          return;
        }
        await subscribeToPush().catch(() => undefined);
        setPushEnabled(true);
        showLocalNotification("SIGIC Activado", "Recibirás avisos de heladas, stock crítico y recetas técnicas en este dispositivo.");
        toast.success("Notificaciones activadas en este dispositivo");
      } else {
        await unsubscribeFromPush().catch(() => undefined);
        setPushEnabled(false);
        toast.info("Suscripción push desactivada");
      }
    } finally {
      setPushBusy(false);
    }
  };

  const updateProfileMutation = useMutation({
    mutationFn: async ({ name, phoneNumber, avatar }: { name: string; phoneNumber: string; avatar: string }) => {
      const { data: s } = await supabase.auth.getSession();
      const user = s.session?.user ?? (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("No hay sesión activa");

      const trimmedName = name.trim();
      const trimmedPhone = phoneNumber.trim();

      const nameErr = validateName(trimmedName);
      if (nameErr) throw new Error(nameErr);

      const phoneValidation = phoneSchema.safeParse(trimmedPhone);
      if (!phoneValidation.success) {
        throw new Error(phoneValidation.error.issues[0].message);
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          full_name: trimmedName,
          phone: trimmedPhone || null,
          avatar_url: avatar || null,
          updated_at: new Date().toISOString(),
        });

      if (profileError) throw profileError;

      await supabase.auth
        .updateUser({
          data: {
            full_name: trimmedName,
            phone: trimmedPhone,
          },
        })
        .catch(() => undefined);

      return { full_name: trimmedName, phone: trimmedPhone };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-header"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["edit-profile-data"] });
      toast.success("Perfil actualizado con éxito");
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Error al actualizar el perfil");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nameErr = validateName(fullName);
    const phoneErr = validatePhone(phone);
    setTouched({ name: true, phone: true });
    setErrors({ name: nameErr, phone: phoneErr });
    if (nameErr || phoneErr) return;
    updateProfileMutation.mutate({
      name: fullName.trim(),
      phoneNumber: phone.trim(),
      avatar: avatarUrl,
    });
  };

  const primaryRole = userQuery.data?.roles?.includes("admin")
    ? "Administrador"
    : userQuery.data?.roles?.includes("tecnico")
      ? "Técnico Agrícola"
      : "Agricultor";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <User className="size-5 text-primary" />
            Perfil y Dispositivo
          </DialogTitle>
        </DialogHeader>

        {userQuery.isLoading ? (
          <div className="py-8 flex items-center justify-center">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div className="flex items-center gap-3.5 rounded-xl border border-border bg-muted/30 p-3">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Avatar de perfil"
                  className="size-14 rounded-full border border-primary/30 object-cover shrink-0"
                />
              ) : (
                <div className="grid size-14 shrink-0 place-items-center rounded-full bg-primary/15 text-primary font-bold text-lg">
                  {(fullName || "U").charAt(0).toUpperCase()}
                </div>
              )}
              <div className="space-y-1">
                <p className="text-xs font-semibold text-foreground">Foto de perfil o emblema de finca</p>
                <div className="flex items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-accent">
                    <Camera className="size-3.5 text-primary" />
                    Cambiar foto
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file) return;
                        try {
                          const compressed = await compressImageFileToDataUrl(file, {
                            maxDimension: 220,
                            quality: 0.78,
                          });
                          setAvatarUrl(compressed);
                        } catch (err: any) {
                          toast.error(err?.message ?? "Error al cargar foto");
                        }
                      }}
                    />
                  </label>
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={() => setAvatarUrl("")}
                      className="text-xs text-muted-foreground hover:text-destructive"
                    >
                      Quitar
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-muted/40 border border-border space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Mail className="size-3.5" /> Correo electrónico:
                </span>
                <span className="font-semibold text-foreground truncate max-w-[200px]">{userQuery.data?.email}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Shield className="size-3.5" /> Rol activo:
                </span>
                <span className="font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">
                  {primaryRole}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="profile-full-name" className="text-xs font-medium">
                Nombre Completo
              </Label>
              <div className="relative">
                <User className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="profile-full-name"
                  value={fullName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFullName(val);
                    if (touched.name) setErrors((prev) => ({ ...prev, name: validateName(val) }));
                  }}
                  onBlur={() => {
                    setTouched((prev) => ({ ...prev, name: true }));
                    setErrors((prev) => ({ ...prev, name: validateName(fullName) }));
                  }}
                  placeholder="Tu nombre completo"
                  required
                  className={`pl-9 h-10 text-sm ${touched.name && errors.name ? "border-destructive" : ""}`}
                />
              </div>
              {touched.name && errors.name && <p className="text-xs text-destructive mt-1 font-medium">{errors.name}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="profile-phone" className="text-xs font-medium">
                Número de Teléfono / WhatsApp
              </Label>
              <div className="relative">
                <Phone className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="profile-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPhone(val);
                    if (touched.phone) setErrors((prev) => ({ ...prev, phone: validatePhone(val) }));
                  }}
                  onBlur={() => {
                    setTouched((prev) => ({ ...prev, phone: true }));
                    setErrors((prev) => ({ ...prev, phone: validatePhone(phone) }));
                  }}
                  placeholder="3001234567 o +573001234567"
                  className={`pl-9 h-10 text-sm ${touched.phone && errors.phone ? "border-destructive" : ""}`}
                />
              </div>
              {touched.phone && errors.phone && <p className="text-xs text-destructive mt-1 font-medium">{errors.phone}</p>}
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                  <BellRing className="size-3.5 text-primary" />
                  Notificaciones Push en este dispositivo
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Recibe alertas de heladas, lluvia fuerte, stock bajo y recetas técnicas.
                </p>
              </div>
              <Switch
                checked={pushEnabled}
                disabled={pushBusy}
                onCheckedChange={(val) => void handleTogglePush(val)}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={updateProfileMutation.isPending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateProfileMutation.isPending || !isFormValid} className="gap-2">
                {updateProfileMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {updateProfileMutation.isPending ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
