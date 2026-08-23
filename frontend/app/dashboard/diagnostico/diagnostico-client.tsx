"use client";

import { useState, useTransition } from "react";
import { FormError } from "@/components/form-error";
import type { SessionDiagnostico } from "@/lib/session";
import type { Pregunta } from "@/services/diagnostico.service";
import {
  crearDiagnosticoAction,
  finalizarDiagnosticoAction,
  responderPreguntaAction,
  simularDiagnosticoAction,
} from "./actions";
import { PreguntaCard, type EstadoPregunta } from "./pregunta-card";

type Alternativa = "A" | "B" | "C";
type Fase = "inicio" | "reanudar" | "preguntas";

export function DiagnosticoClient({
  diagnosticoActivo,
  demoModeOffInicial,
}: {
  diagnosticoActivo: SessionDiagnostico | null;
  demoModeOffInicial: boolean;
}) {
  const [fase, setFase] = useState<Fase>(
    diagnosticoActivo?.estado === "en_progreso" ? "reanudar" : "inicio",
  );
  const [diagnosticoId, setDiagnosticoId] = useState<string | null>(
    diagnosticoActivo?.id ?? null,
  );
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [respuestas, setRespuestas] = useState<Record<string, Alternativa>>(
    {},
  );
  const [estadoPregunta, setEstadoPregunta] = useState<
    Record<string, EstadoPregunta>
  >({});
  const [demoModeOff, setDemoModeOff] = useState(demoModeOffInicial);
  const [error, setError] = useState<string | null>(null);

  const [creando, startCrear] = useTransition();
  const [simulando, startSimular] = useTransition();
  const [finalizando, startFinalizar] = useTransition();
  const [, startResponder] = useTransition();

  function empezarDiagnostico() {
    setError(null);
    startCrear(async () => {
      const result = await crearDiagnosticoAction();
      if (!result.success || !result.data) {
        setError(result.message);
        return;
      }
      setDiagnosticoId(result.data.diagnostico.id);
      setPreguntas(result.data.preguntas);
      setRespuestas({});
      setEstadoPregunta({});
      setFase("preguntas");
    });
  }

  function responder(preguntaId: string, alternativa: Alternativa) {
    if (!diagnosticoId) return;
    setRespuestas((prev) => ({ ...prev, [preguntaId]: alternativa }));
    setEstadoPregunta((prev) => ({ ...prev, [preguntaId]: "guardando" }));
    startResponder(async () => {
      const result = await responderPreguntaAction(
        diagnosticoId,
        preguntaId,
        alternativa,
      );
      setEstadoPregunta((prev) => ({
        ...prev,
        [preguntaId]: result.success ? "guardado" : "error",
      }));
    });
  }

  function simular() {
    if (!diagnosticoId) return;
    setError(null);
    startSimular(async () => {
      const result = await simularDiagnosticoAction(diagnosticoId);
      // Si tuvo éxito la action ya redirigió (lanza internamente) y esta
      // línea no se alcanza. Solo llegamos acá si falló o si no hay demo.
      if (result.notFound) {
        setDemoModeOff(true);
        return;
      }
      if (!result.success) {
        setError(result.message);
      }
    });
  }

  function finalizar() {
    if (!diagnosticoId) return;
    setError(null);
    startFinalizar(async () => {
      const result = await finalizarDiagnosticoAction(diagnosticoId);
      if (!result.success) {
        setError(result.message);
      }
    });
  }

  if (fase === "inicio") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm font-medium tracking-wide text-accent uppercase">
          Diagnóstico
        </p>
        <h1 className="max-w-lg font-serif text-3xl text-foreground">
          60 preguntas para medir tu nivel actual
        </h1>
        <p className="max-w-md text-muted-foreground">
          Responde a tu ritmo — cada respuesta se guarda automáticamente.
        </p>
        {error ? <FormError message={error} /> : null}
        <button
          onClick={empezarDiagnostico}
          disabled={creando}
          className="mt-2 rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {creando ? "Creando…" : "Empezar diagnóstico"}
        </button>
      </main>
    );
  }

  if (fase === "reanudar") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm font-medium tracking-wide text-accent uppercase">
          Diagnóstico
        </p>
        <h1 className="max-w-lg font-serif text-3xl text-foreground">
          Tienes un diagnóstico en progreso
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Puedes finalizarlo con lo que ya respondiste
          {demoModeOff ? "" : " o simular el resto"} para ver tu reporte.
        </p>
        {error ? <FormError message={error} /> : null}
        <div className="mt-2 flex gap-3">
          {!demoModeOff && (
            <button
              onClick={simular}
              disabled={simulando || finalizando}
              className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
            >
              {simulando ? "Simulando…" : "Simular respuestas"}
            </button>
          )}
          <button
            onClick={finalizar}
            disabled={finalizando || simulando}
            className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {finalizando ? "Finalizando…" : "Finalizar diagnóstico"}
          </button>
        </div>
      </main>
    );
  }

  const respondidasCount = Object.keys(estadoPregunta).filter(
    (id) => estadoPregunta[id] === "guardado",
  ).length;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-8">
      <header className="sticky top-0 z-10 -mx-6 flex flex-col gap-3 border-b border-border bg-background/95 px-6 py-4 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">
            {respondidasCount} / {preguntas.length} respondidas
          </p>
          <div className="flex gap-2">
            {!demoModeOff && (
              <button
                onClick={simular}
                disabled={simulando || finalizando}
                className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
              >
                {simulando ? "Simulando…" : "Simular respuestas"}
              </button>
            )}
            <button
              onClick={finalizar}
              disabled={finalizando || simulando}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {finalizando ? "Finalizando…" : "Finalizar diagnóstico"}
            </button>
          </div>
        </div>
        {error ? <FormError message={error} /> : null}
      </header>

      <ol className="flex flex-col gap-6">
        {preguntas.map((pregunta, index) => (
          <PreguntaCard
            key={pregunta.id}
            numero={index + 1}
            pregunta={pregunta}
            seleccionada={respuestas[pregunta.id]}
            estado={estadoPregunta[pregunta.id] ?? "idle"}
            onResponder={(alternativa) => responder(pregunta.id, alternativa)}
          />
        ))}
      </ol>
    </div>
  );
}
