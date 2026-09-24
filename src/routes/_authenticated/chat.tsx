import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";

import { AiChat } from "@/components/chat/ai-chat";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({ meta: [{ title: "Asistente IA — SIGIC" }] }),
  component: ChatPage,
});

function ChatPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <h1 className="text-3xl font-bold">{t("chat.title")}</h1>
        <p className="text-sm text-muted-foreground">Diagnóstico por foto, recomendaciones de fertilización y manejo integrado de cultivos.</p>
      </header>
      <Suspense fallback={<div className="h-[500px] rounded-xl bg-muted animate-pulse" />}>
        <AiChat />
      </Suspense>
    </div>
  );
}
