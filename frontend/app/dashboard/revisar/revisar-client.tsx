"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { NOMBRES_COMPETENCIA } from "@/lib/competencias";
import type {
  Alternativa,
  RespuestaRevision,
} from "@/services/diagnostico.service";

const LETRAS: Alternativa[] = ["A", "B", "C"];
const ORDEN_COMPETENCIAS = Object.keys(NOMBRES_COMPETENCIA);

type Filtro = "todas" | "falladas";

interface PreguntaNumerada extends RespuestaRevision {
  numero: number;
}

export function RevisarClient({
  respuestas,
  desdeHistorial,
}: {
  respuestas: RespuestaRevision[];
  desdeHistorial: boolean;
}) {
  const [filtro, setFiltro] = useState<Filtro>("todas");

  const numeradas: PreguntaNumerada[] = useMemo(
    () => respuestas.map((r, i) => ({ ...r, numero: i + 1 })),
    [respuestas],
  );

  const totalFalladas = numeradas.filter((p) => !p.esCorrecta).length;

  const visibles =
    filtro === "falladas"
      ? numeradas.filter((p) => !p.esCorrecta)
      : numeradas;

  const grupos = useMemo(() => {
    const porCompetencia = new Map<string, PreguntaNumerada[]>();
    for (const p of visibles) {
      const lista = porCompetencia.get(p.competencia) ?? [];
      lista.push(p);
      porCompetencia.set(p.competencia, lista);
    }
    const claves = [...porCompetencia.keys()].sort((a, b) => {
      const ia = ORDEN_COMPETENCIAS.indexOf(a);
      const ib = ORDEN_COMPETENCIAS.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
    return claves.map((clave) => ({
      competencia: clave,
      preguntas: porCompetencia.get(clave)!,
    }));
  }, [visibles]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10">
      {desdeHistorial ? (
        <Link
          href="/dashboard/historial"
          className="self-start text-sm font-medium text-primary"
        >
          ← Volver al historial
        </Link>
      ) : null}

      <header className="flex flex-col gap-1">
        <p className="text-sm font-medium tracking-wide text-accent uppercase">
          Revisar respuestas
        </p>
        <h1 className="font-serif text-3xl text-foreground">
          Tu diagnóstico pregunta por pregunta
        </h1>
        <p className="text-sm text-muted-foreground">
          {numeradas.length - totalFalladas} de {numeradas.length} correctas ·{" "}
          {totalFalladas} para repasar
        </p>
      </header>

      <div className="sticky top-0 z-10 -mx-6 flex gap-2 border-b border-border bg-background/95 px-6 py-3 backdrop-blur">
        <FiltroBoton
          activo={filtro === "todas"}
          onClick={() => setFiltro("todas")}
        >
          Todas ({numeradas.length})
        </FiltroBoton>
        <FiltroBoton
          activo={filtro === "falladas"}
          onClick={() => setFiltro("falladas")}
        >
          Solo falladas ({totalFalladas})
        </FiltroBoton>
      </div>

      {grupos.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface p-6 text-sm text-muted-foreground shadow-sm">
          No fallaste ninguna pregunta. ¡Bien ahí!
        </p>
      ) : (
        grupos.map((grupo) => {
          const correctasGrupo = numeradas.filter(
            (p) => p.competencia === grupo.competencia && p.esCorrecta,
          ).length;
          const totalGrupo = numeradas.filter(
            (p) => p.competencia === grupo.competencia,
          ).length;
          return (
            <section
              key={grupo.competencia}
              className="flex flex-col gap-3"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-serif text-xl text-foreground">
                  {NOMBRES_COMPETENCIA[grupo.competencia] ?? grupo.competencia}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {correctasGrupo} / {totalGrupo} correctas
                </span>
              </div>
              <ul className="flex flex-col gap-4">
                {grupo.preguntas.map((p) => (
                  <PreguntaRevision key={p.preguntaId} pregunta={p} />
                ))}
              </ul>
            </section>
          );
        })
      )}
    </main>
  );
}

function FiltroBoton({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        activo
          ? "bg-primary text-primary-foreground"
          : "border border-border bg-surface text-foreground hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}

function PreguntaRevision({ pregunta }: { pregunta: PreguntaNumerada }) {
  const { numero, enunciado, alternativas, respuestaCorrecta } = pregunta;
  const elegida = pregunta.alternativaElegida;
  const fallada = !pregunta.esCorrecta;
  const sinResponder = elegida === null;

  return (
    <li className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <p className="mb-3 text-sm font-medium text-foreground">
        <span className="text-accent">{numero}.</span> {enunciado}
      </p>

      <div className="flex flex-col gap-2">
        {LETRAS.map((letra) => {
          const esCorrecta = letra === respuestaCorrecta;
          const esElegida = letra === elegida;
          const estilo = esCorrecta
            ? "border-green-600/50 bg-green-50 text-green-900 dark:border-green-500/40 dark:bg-green-950/30 dark:text-green-200"
            : esElegida
              ? "border-red-500/50 bg-red-50 text-red-900 dark:border-red-500/40 dark:bg-red-950/30 dark:text-red-200"
              : "border-border text-foreground";
          return (
            <div
              key={letra}
              className={`flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm ${estilo}`}
            >
              <span>
                <span className="font-medium">{letra}.</span>{" "}
                {alternativas[letra]}
              </span>
              {esCorrecta || esElegida ? (
                <span className="shrink-0 text-xs font-medium">
                  {esCorrecta && esElegida
                    ? "Tu respuesta ✓"
                    : esCorrecta
                      ? "Correcta"
                      : "Tu respuesta"}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      {sinResponder ? (
        <p className="mt-3 text-xs text-muted-foreground">
          No respondiste esta pregunta.
        </p>
      ) : null}

      {fallada && !sinResponder ? (
        <ExplicacionBloque explicacion={pregunta.explicacion} />
      ) : null}
    </li>
  );
}

function ExplicacionBloque({ explicacion }: { explicacion: string | null }) {
  if (explicacion === null) {
    return (
      <p className="mt-3 rounded-lg border border-border bg-muted px-3 py-2.5 text-xs text-muted-foreground">
        La explicación se está generando. Vuelve a esta pantalla en un momento
        y recárgala.
      </p>
    );
  }

  return (
    <div className="mt-3 flex gap-2 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2.5">
      <span aria-hidden className="text-sm leading-5">
        💡
      </span>
      <div className="flex flex-col gap-0.5">
        <p className="text-xs font-medium tracking-wide text-accent uppercase">
          Por qué
        </p>
        <p className="text-sm text-foreground">{explicacion}</p>
      </div>
    </div>
  );
}
