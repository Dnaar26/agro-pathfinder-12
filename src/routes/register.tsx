import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "./auth";

export const Route = createFileRoute("/register")({
  ssr: false,
  head: () => ({ meta: [{ title: "Crear Cuenta — SIGIC" }] }),
  component: () => <AuthPage initialTab="signup" />,
});
