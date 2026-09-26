import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { User, Phone, Mail, Shield, Loader2, Save } from "lucide-react";
import { phoneSchema } from "@/lib/schemas/phone";

interface EditProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditProfileDialog({ open, onOpenChange }: EditProfileDialogProps) {
  const qc = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
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
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name, phone, avatar_url")
        .eq("id", u.user.id)
        .maybeSingle();

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.user.id);

      return {
        id: u.user.id,
        email: u.user.email,
        fullName: p?.full_name ?? (u.user.user_metadata?.full_name || ""),
        phone: p?.phone ?? (u.user.user_metadata?.phone || ""),
        roles: (roles ?? []).map((r: any) => r.role),
      };
    },
    enabled: open,
  });

  useEffect(() => {
    if (userQuery.data) {
      setFullName(userQuery.data.fullName);
      setPhone(userQuery.data.phone);
      setTouched({});
      setErrors({});
    }
  }, [userQuery.data, open]);

  const updateProfileMutation = useMutation({
    mutationFn: async ({ name, phoneNumber }: { name: string; phoneNumber: string }) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("No hay sesión activa");

      const trimmedName = name.trim();
      const trimmedPhone = phoneNumber.trim();

      const nameErr = validateName(trimmedName);
      if (nameErr) throw new Error(nameErr);

      const phoneValidation = phoneSchema.safeParse(trimmedPhone);
      if (!phoneValidation.success) {
        throw new Error(phoneValidation.error.issues[0].message);
      }

      // Actualizar tabla profiles
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
          id: u.user.id,
          full_name: trimmedName,
          phone: trimmedPhone || null,
          updated_at: new Date().toISOString(),
        });

      if (profileError) throw profileError;

      // Actualizar metadata de auth
      await supabase.auth.updateUser({
        data: {
          full_name: trimmedName,
          phone: trimmedPhone,
        },
      }).catch(() => undefined);

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
    if (nameErr || phoneErr) {
      return;
    }
    updateProfileMutation.mutate({ name: fullName.trim(), phoneNumber: phone.trim() });
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
            Editar Perfil de Usuario
          </DialogTitle>
        </DialogHeader>

        {userQuery.isLoading ? (
          <div className="py-8 flex items-center justify-center">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {/* Información del rol y email */}
            <div className="p-3 rounded-lg bg-muted/40 border border-border space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Mail className="size-3.5" /> Correo electrónico:
                </span>
                <span className="font-semibold text-foreground">{userQuery.data?.email}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Shield className="size-3.5" /> Rol en el sistema:
                </span>
                <span className="font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">
                  {primaryRole}
                </span>
              </div>
            </div>

            {/* Nombre completo */}
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
                    if (touched.name) {
                      setErrors((prev) => ({ ...prev, name: validateName(val) }));
                    }
                  }}
                  onBlur={() => {
                    setTouched((prev) => ({ ...prev, name: true }));
                    setErrors((prev) => ({ ...prev, name: validateName(fullName) }));
                  }}
                  placeholder="Tu nombre completo"
                  required
                  className={`pl-9 h-10 text-sm ${touched.name && errors.name ? "border-destructive focus-visible:ring-destructive" : ""}`}
                />
              </div>
              {touched.name && errors.name && (
                <p className="text-xs text-destructive mt-1 font-medium">{errors.name}</p>
              )}
            </div>

            {/* Teléfono */}
            <div className="space-y-1.5">
              <Label htmlFor="profile-phone" className="text-xs font-medium">
                Número de Teléfono
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
                    if (touched.phone) {
                      setErrors((prev) => ({ ...prev, phone: validatePhone(val) }));
                    }
                  }}
                  onBlur={() => {
                    setTouched((prev) => ({ ...prev, phone: true }));
                    setErrors((prev) => ({ ...prev, phone: validatePhone(phone) }));
                  }}
                  placeholder="3001234567 o +573001234567"
                  className={`pl-9 h-10 text-sm ${touched.phone && errors.phone ? "border-destructive focus-visible:ring-destructive" : ""}`}
                />
              </div>
              {touched.phone && errors.phone && (
                <p className="text-xs text-destructive mt-1 font-medium">{errors.phone}</p>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={updateProfileMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={updateProfileMutation.isPending || !isFormValid}
                className="gap-2"
              >
                {updateProfileMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                {updateProfileMutation.isPending ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
