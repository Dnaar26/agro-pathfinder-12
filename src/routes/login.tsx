import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "./auth";

export const Route = createFileRoute("/login")({
  ssr: false,
  head: () => ({ meta: [{ title: "Iniciar Sesión — SIGIC" }] }),
  component: () => <AuthPage initialTab="login" />,
});
