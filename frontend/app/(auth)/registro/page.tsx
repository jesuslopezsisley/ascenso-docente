import type { Metadata } from "next";
import { AuthCard } from "@/components/auth-card";
import { listarNivelesEspecialidad } from "@/services/nivel-especialidad.service";
import { RegistroForm } from "./registro-form";

export const metadata: Metadata = {
  title: "Crear cuenta — Ascenso Docente",
};

export default async function RegistroPage() {
  const resultado = await listarNivelesEspecialidad();
  const niveles = resultado.data ?? [];

  return (
    <AuthCard
      title="Crea tu cuenta"
      subtitle="Empieza tu diagnóstico y plan de estudio."
    >
      <RegistroForm niveles={niveles} />
    </AuthCard>
  );
}
