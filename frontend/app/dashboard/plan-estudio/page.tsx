import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { obtenerProgreso } from "@/services/plan-estudio.service";
import { PlanEstudioClient } from "./plan-estudio-client";

export const metadata: Metadata = {
  title: "Plan de estudio — Ascenso Docente",
};

export default async function PlanEstudioPage() {
  // El layout de /dashboard ya garantiza que hay sesión.
  const session = await getSession();
  const diagnostico = session?.diagnostico;

  if (!diagnostico || diagnostico.estado !== "completado") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm font-medium tracking-wide text-accent uppercase">
          Plan de estudio
        </p>
        <h1 className="max-w-lg font-serif text-3xl text-foreground">
          Primero necesitas terminar tu diagnóstico
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          El plan de estudio se genera a partir del reporte de tu
          diagnóstico.
        </p>
        <Link
          href="/dashboard/diagnostico"
          className="mt-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Ir al diagnóstico
        </Link>
      </main>
    );
  }

  // El backend no expone un GET que devuelva el plan completo (solo el POST
  // que lo genera/regenera y este GET de progreso). Se usa el 404 de
  // /progreso como señal de "todavía no hay plan generado".
  const progreso = await obtenerProgreso(diagnostico.id);

  return (
    <PlanEstudioClient
      diagnosticoId={diagnostico.id}
      tienePlanInicial={!progreso.notFound && progreso.success}
      progresoInicial={progreso.data ?? null}
    />
  );
}
