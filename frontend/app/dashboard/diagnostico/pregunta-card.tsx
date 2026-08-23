"use client";

import type { Pregunta } from "@/services/diagnostico.service";

const ALTERNATIVAS = ["A", "B", "C"] as const;
type Alternativa = (typeof ALTERNATIVAS)[number];

export type EstadoPregunta = "idle" | "guardando" | "guardado" | "error";

export function PreguntaCard({
  numero,
  pregunta,
  seleccionada,
  estado,
  onResponder,
}: {
  numero: number;
  pregunta: Pregunta;
  seleccionada?: Alternativa;
  estado: EstadoPregunta;
  onResponder: (alternativa: Alternativa) => void;
}) {
  return (
    <li className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <p className="mb-3 text-sm font-medium text-foreground">
        <span className="text-accent">{numero}.</span> {pregunta.enunciado}
      </p>

      <div className="flex flex-col gap-2">
        {ALTERNATIVAS.map((letra) => (
          <label
            key={letra}
            className="flex cursor-pointer items-start gap-2 rounded-md border border-border px-3 py-2 text-sm text-foreground transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
          >
            <input
              type="radio"
              name={`pregunta-${pregunta.id}`}
              value={letra}
              checked={seleccionada === letra}
              onChange={() => onResponder(letra)}
              className="mt-0.5 accent-primary"
            />
            <span>
              <span className="font-medium">{letra}.</span>{" "}
              {pregunta.alternativas[letra]}
            </span>
          </label>
        ))}
      </div>

      <p className="mt-2 h-4 text-xs text-muted-foreground">
        {estado === "guardando" && "Guardando…"}
        {estado === "guardado" && "Guardado ✓"}
        {estado === "error" && "No se pudo guardar, intenta de nuevo."}
      </p>
    </li>
  );
}
