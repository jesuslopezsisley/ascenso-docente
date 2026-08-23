import type { Metadata } from "next";
import { AuthCard } from "@/components/auth-card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Iniciar sesión — Ascenso Docente",
};

export default function LoginPage() {
  return (
    <AuthCard
      title="Bienvenido de vuelta"
      subtitle="Ingresa para continuar tu preparación."
    >
      <LoginForm />
    </AuthCard>
  );
}
