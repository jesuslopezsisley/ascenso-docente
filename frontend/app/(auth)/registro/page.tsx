import type { Metadata } from "next";
import { AuthCard } from "@/components/auth-card";
import { RegistroForm } from "./registro-form";

export const metadata: Metadata = {
  title: "Crear cuenta — Ascenso Docente",
};

export default function RegistroPage() {
  return (
    <AuthCard
      title="Crea tu cuenta"
      subtitle="Empieza tu diagnóstico y plan de estudio."
    >
      <RegistroForm />
    </AuthCard>
  );
}
