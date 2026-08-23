"use client";

import { NOMBRES_COMPETENCIA } from "@/lib/competencias";
import type { SesionPlanEstudio } from "@/services/plan-estudio.service";

export function SesionCard({
  sesion,
  guardando,
  onCompletar,
}: {
  sesion: SesionPlanEstudio;
  guardando: boolean;
  onCompletar: () => void;
}) {
  return (
    <li
      className={`rounded-xl border p-4 shadow-sm transition-colors ${
        sesion.completada
          ? "border-primary/30 bg-primary/5"
          : "border-border bg-surface"
      }`}
    >
      <p className="text-xs font-medium tracking-wide text-accent uppercase">
        {NOMBRES_COMPETENCIA[sesion.competencia] ?? sesion.competencia}
      </p>
      <p className="mt-1 text-sm font-medium text-foreground">
        {sesion.tema}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {sesion.quePracticar}
      </p>

      <button
        onClick={onCompletar}
        disabled={sesion.completada || guardando}
        className="mt-3 flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-default disabled:hover:bg-transparent"
      >
        <span
          className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] ${
            sesion.completada
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border"
          }`}
        >
          {sesion.completada ? "✓" : ""}
        </span>
        {sesion.completada
          ? "Completada"
          : guardando
            ? "Guardando…"
            : "Marcar como completada"}
      </button>
    </li>
  );
}
