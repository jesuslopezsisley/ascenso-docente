import type { Metadata } from "next";
import Link from "next/link";
import { NOMBRES_COMPETENCIA } from "@/lib/competencias";
import { getSession } from "@/lib/session";
import { finalizarDiagnostico } from "@/services/diagnostico.service";
import { obtenerProgreso } from "@/services/plan-estudio.service";

export const metadata: Metadata = {
  title: "Inicio — Ascenso Docente",
};

const CARD = "rounded-xl border border-border bg-surface p-6 shadow-sm";

export default async function DashboardPage() {
  // El layout de /dashboard ya garantiza que hay sesión.
  const session = await getSession();
  const nombre = session?.user.nombre ?? "";
  const diagnostico = session?.diagnostico;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-1">
        <p className="text-sm font-medium tracking-wide text-accent uppercase">
          Ascenso Docente
        </p>
        <h1 className="font-serif text-3xl text-foreground">
          Hola, {nombre}
        </h1>
      </header>

      {!diagnostico ? (
        <EmpezarDiagnostico />
      ) : diagnostico.estado === "en_progreso" ? (
        <DiagnosticoEnProgreso />
      ) : (
        <DiagnosticoCompletado diagnosticoId={diagnostico.id} />
      )}
    </main>
  );
}

function EmpezarDiagnostico() {
  return (
    <section className={`${CARD} flex flex-col items-start gap-3`}>
      <h2 className="font-serif text-xl text-foreground">
        Aún no has hecho tu diagnóstico
      </h2>
      <p className="text-sm text-muted-foreground">
        Son 60 preguntas para medir tu nivel actual por competencia. A partir
        del resultado se arma tu plan de estudio.
      </p>
      <Link
        href="/dashboard/diagnostico"
        className="mt-1 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        Empezar mi diagnóstico
      </Link>
    </section>
  );
}

function DiagnosticoEnProgreso() {
  return (
    <section className={`${CARD} flex flex-col items-start gap-3`}>
      <h2 className="font-serif text-xl text-foreground">
        Tienes un diagnóstico en progreso
      </h2>
      <p className="text-sm text-muted-foreground">
        Puedes retomarlo donde lo dejaste; cada respuesta quedó guardada.
      </p>
      <Link
        href="/dashboard/diagnostico"
        className="mt-1 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        Continuar diagnóstico
      </Link>
    </section>
  );
}

async function DiagnosticoCompletado({
  diagnosticoId,
}: {
  diagnosticoId: string;
}) {
  // `finalizar` es idempotente: si ya estaba completado devuelve el mismo
  // reporte. `obtenerProgreso` responde 404 (notFound) si todavía no se
  // generó un plan de estudio.
  const [reporteRes, progresoRes] = await Promise.all([
    finalizarDiagnostico(diagnosticoId),
    obtenerProgreso(diagnosticoId),
  ]);

  const reporte = reporteRes.data;
  const masDebiles = reporte
    ? [...reporte.reporte].sort((a, b) => a.porcentaje - b.porcentaje).slice(0, 3)
    : [];

  const progreso =
    progresoRes.success && !progresoRes.notFound ? progresoRes.data : null;

  return (
    <>
      <section className={`${CARD} flex flex-col gap-5`}>
        <div className="flex flex-col gap-1">
          <h2 className="font-serif text-xl text-foreground">
            Resumen de tu diagnóstico
          </h2>
          {reporte ? (
            <p className="text-sm text-muted-foreground">
              {reporte.resumen.correctasTotal} de{" "}
              {reporte.resumen.totalPreguntas} respuestas correctas
            </p>
          ) : null}
        </div>

        {reporte ? (
          <>
            <div>
              <p className="font-serif text-4xl text-foreground">
                {reporte.resumen.porcentajeTotal}%
              </p>
              <p className="text-xs text-muted-foreground">Puntaje general</p>
            </div>

            {masDebiles.length > 0 ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium tracking-wide text-accent uppercase">
                  Competencias más débiles
                </p>
                <ul className="flex flex-col gap-2">
                  {masDebiles.map((c) => (
                    <li
                      key={c.competencia}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="text-foreground">
                        {NOMBRES_COMPETENCIA[c.competencia] ?? c.competencia}
                      </span>
                      <span className="shrink-0 font-semibold text-foreground">
                        {c.porcentaje}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <Link
              href="/dashboard/reporte"
              className="self-start rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Ver reporte completo
            </Link>
          </>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted-foreground">
              No pudimos cargar tu resumen. {reporteRes.message}
            </p>
            <Link
              href="/dashboard/reporte"
              className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Ir a mi reporte
            </Link>
          </div>
        )}
      </section>

      <section className={`${CARD} flex flex-col gap-3`}>
        <h2 className="font-serif text-xl text-foreground">Plan de estudio</h2>
        {progreso ? (
          <>
            <p className="text-sm font-medium text-foreground">
              {progreso.completadas} de {progreso.totalSesiones} sesiones
              completadas — {progreso.porcentaje}%
            </p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progreso.porcentaje}%` }}
              />
            </div>
            <Link
              href="/dashboard/plan-estudio"
              className="mt-1 self-start rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Ir a mi plan
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Aún no generas tu plan de estudio. Se arma con IA a partir del
              reporte de tu diagnóstico.
            </p>
            <Link
              href="/dashboard/plan-estudio"
              className="mt-1 self-start rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Generar mi plan
            </Link>
          </>
        )}
      </section>
    </>
  );
}
