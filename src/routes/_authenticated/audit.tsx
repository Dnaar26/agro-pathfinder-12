import { createFileRoute, redirect } from "@tanstack/react-router";
import { AuditLog } from "@/components/audit/audit-log";
import { getMyRoles } from "@/lib/queries";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated/audit")({
  head: () => ({ meta: [{ title: "Auditoría — SIGIC" }] }),
  beforeLoad: async () => {
    const roles = await getMyRoles();
    if (!roles.includes("admin")) throw redirect({ to: "/dashboard" });
  },
  component: AuditPage,
});

function AuditPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">{t("audit.title")}</h1>
        <p className="text-sm text-muted-foreground">Registro de cambios sensibles en parcelas, roles y configuración.</p>
      </header>
      <AuditLog />
    </div>
  );
}
