import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { NOMBRES_COMPETENCIA } from "@/lib/competencias";
import { getSession } from "@/lib/session";
import { finalizarDiagnostico } from "@/services/diagnostico.service";

export const metadata: Metadata = {
  title: "Reporte — Ascenso Docente",
};

export default async function ReportePage() {
  // El layout de /dashboard ya garantiza que hay sesión.
  const session = await getSession();
  const diagnosticoId = session?.diagnostico?.id;

  if (!diagnosticoId) {
    redirect("/dashboard/diagnostico");
  }

  // finalizar() es idempotente en el backend: si ya estaba completado,
  // simplemente devuelve el mismo reporte de nuevo.
  const result = await finalizarDiagnostico(diagnosticoId);

  if (!result.success || !result.data) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-serif text-3xl text-foreground">
          No se pudo cargar tu reporte
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          {result.message}
        </p>
        <Link
          href="/dashboard/diagnostico"
          className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Volver al diagnóstico
        </Link>
      </main>
    );
  }

  // Nota: esta página nunca escribe la cookie de sesión (Next.js solo
  // permite mutar cookies desde una Server Action o Route Handler, no
  // durante el render de una página). Marcar el diagnóstico como
  // "completado" en la sesión es responsabilidad de quien redirige acá
  // (finalizarDiagnosticoAction / simularDiagnosticoAction).

  const { reporte, resumen } = result.data;
  const reporteOrdenado = [...reporte].sort((a, b) => a.porcentaje - b.porcentaje);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-12">
      <div className="text-center">
        <p className="text-sm font-medium tracking-wide text-accent uppercase">
          Reporte del diagnóstico
        </p>
        <h1 className="mt-2 font-serif text-4xl text-foreground">
          {resumen.porcentajeTotal}% de aciertos
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {resumen.correctasTotal} de {resumen.totalPreguntas} preguntas
          correctas
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {reporteOrdenado.map((c) => (
          <li
            key={c.competencia}
            className="rounded-xl border border-border bg-surface p-4 shadow-sm"
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-foreground">
                {NOMBRES_COMPETENCIA[c.competencia] ?? c.competencia}
              </p>
              <p className="text-sm font-semibold text-foreground">
                {c.porcentaje}%
              </p>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${c.porcentaje}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {c.correctas} / {c.total} correctas
            </p>
          </li>
        ))}
      </ul>

      <div className="flex justify-center gap-3">
        <Link
          href="/dashboard"
          className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          Volver al inicio
        </Link>
        <Link
          href="/dashboard/plan-estudio"
          className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Ver mi plan de estudio
        </Link>
      </div>
    </main>
  );
}
