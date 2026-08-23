"use client";

import { useState, useTransition } from "react";
import { FormError } from "@/components/form-error";
import {
  completarSesion,
  generarPlanEstudio,
  type PlanEstudio,
  type ProgresoPlanEstudio,
} from "@/services/plan-estudio.service";
import { SesionCard } from "./sesion-card";

type Fase = "generar" | "resumen" | "plan";

function calcularProgreso(plan: PlanEstudio): ProgresoPlanEstudio {
  const completadas = plan.sesiones.filter((s) => s.completada).length;
  const total = plan.sesiones.length;
  return {
    totalSesiones: total,
    completadas,
    porcentaje: total > 0 ? Math.round((completadas / total) * 1000) / 10 : 0,
  };
}

export function PlanEstudioClient({
  diagnosticoId,
  tienePlanInicial,
  progresoInicial,
}: {
  diagnosticoId: string;
  tienePlanInicial: boolean;
  progresoInicial: ProgresoPlanEstudio | null;
}) {
  const [fase, setFase] = useState<Fase>(
    tienePlanInicial ? "resumen" : "generar",
  );
  const [plan, setPlan] = useState<PlanEstudio | null>(null);
  const [progreso, setProgreso] = useState<ProgresoPlanEstudio | null>(
    progresoInicial,
  );
  const [error, setError] = useState<string | null>(null);
  const [completandoIds, setCompletandoIds] = useState<Set<string>>(
    new Set(),
  );

  const [generando, startGenerar] = useTransition();
  const [, startCompletar] = useTransition();

  function generar() {
    setError(null);
    startGenerar(async () => {
      const result = await generarPlanEstudio(diagnosticoId);
      if (!result.success || !result.data) {
        setError(result.message);
        return;
      }
      setPlan(result.data);
      setProgreso(calcularProgreso(result.data));
      setFase("plan");
    });
  }

  function completar(sesionId: string) {
    setCompletandoIds((prev) => new Set(prev).add(sesionId));
    startCompletar(async () => {
      const result = await completarSesion(diagnosticoId, sesionId);
      setCompletandoIds((prev) => {
        const next = new Set(prev);
        next.delete(sesionId);
        return next;
      });

      if (!result.success) {
        setError(result.message);
        return;
      }

      setPlan((prev) => {
        if (!prev) return prev;
        const sesiones = prev.sesiones.map((s) =>
          s.id === sesionId ? { ...s, completada: true } : s,
        );
        setProgreso(calcularProgreso({ ...prev, sesiones }));
        return { ...prev, sesiones };
      });
    });
  }

  if (fase === "generar") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm font-medium tracking-wide text-accent uppercase">
          Plan de estudio
        </p>
        <h1 className="max-w-lg font-serif text-3xl text-foreground">
          Un plan personalizado, hecho con IA a partir de tu diagnóstico
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Prioriza las competencias en las que te fue peor, con sesiones
          concretas por semana.
        </p>

        {error ? <FormError message={error} /> : null}

        {generando ? (
          <div className="mt-2 flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
            <p className="text-sm font-medium text-foreground">
              Generando tu plan personalizado…
            </p>
            <p className="text-xs text-muted-foreground">
              Esto puede tomar hasta 20-30 segundos.
            </p>
          </div>
        ) : (
          <button
            onClick={generar}
            className="mt-2 rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Generar mi plan de estudio
          </button>
        )}
      </main>
    );
  }

  if (fase === "resumen") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm font-medium tracking-wide text-accent uppercase">
          Plan de estudio
        </p>
        <h1 className="font-serif text-3xl text-foreground">
          Ya tienes un plan generado
        </h1>
        {progreso ? (
          <p className="text-muted-foreground">
            {progreso.completadas} de {progreso.totalSesiones} sesiones
            completadas — {progreso.porcentaje}%
          </p>
        ) : null}
        <p className="max-w-md text-xs text-muted-foreground">
          El detalle de cada sesión no está disponible después de recargar
          la página en esta versión. Puedes regenerar el plan, pero eso
          reinicia el progreso marcado.
        </p>

        {error ? <FormError message={error} /> : null}

        {generando ? (
          <div className="mt-2 flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
            <p className="text-sm font-medium text-foreground">
              Generando tu plan personalizado…
            </p>
          </div>
        ) : (
          <button
            onClick={generar}
            className="mt-2 rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Regenerar plan
          </button>
        )}
      </main>
    );
  }

  if (!plan || !progreso) return null;

  const semanas = Array.from(
    new Set(plan.sesiones.map((s) => s.semana)),
  ).sort((a, b) => a - b);
  const sesionesPorSemana = new Map<number, typeof plan.sesiones>();
  for (const sesion of plan.sesiones) {
    const lista = sesionesPorSemana.get(sesion.semana) ?? [];
    lista.push(sesion);
    sesionesPorSemana.set(sesion.semana, lista);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-8">
      <header className="flex flex-col gap-3">
        <p className="text-sm font-medium tracking-wide text-accent uppercase">
          Plan de estudio — {plan.semanas} semanas
        </p>
        <p className="text-sm text-muted-foreground">{plan.resumen}</p>

        <div className="mt-1 flex flex-col gap-1.5">
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
        </div>

        {error ? <FormError message={error} /> : null}
      </header>

      {semanas.map((numeroSemana) => (
        <section key={numeroSemana} className="flex flex-col gap-3">
          <h2 className="font-serif text-xl text-foreground">
            Semana {numeroSemana}
          </h2>
          <ul className="flex flex-col gap-3">
            {sesionesPorSemana.get(numeroSemana)?.map((sesion) => (
              <SesionCard
                key={sesion.id}
                sesion={sesion}
                guardando={completandoIds.has(sesion.id)}
                onCompletar={() => completar(sesion.id)}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
