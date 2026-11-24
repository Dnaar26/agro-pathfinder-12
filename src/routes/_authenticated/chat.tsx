import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { useTranslation } from "react-i18next";

import { AiChat } from "@/components/chat/ai-chat";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({ meta: [{ title: "Asistente IA — SIGIC" }] }),
  component: ChatPage,
});

function ChatPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4 sm:space-y-6 max-w-4xl">
      <header>
        <h1 className="text-2xl sm:text-3xl font-bold">{t("chat.title")}</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Diagnóstico estructurado por parcela, tablas de fertilización y manejo integrado de cultivos.
        </p>
      </header>
      <Suspense fallback={<div className="h-[520px] rounded-xl bg-muted animate-pulse" />}>
        <AiChat />
      </Suspense>
    </div>
  );
}
