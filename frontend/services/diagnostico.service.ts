"use server";

import { api } from "@/lib/api";
import { callApi, type ServiceResult } from "@/lib/service-result";

/**
 * Capa de servicios (docs/arquitectura-base.md §5.3): una función por
 * operación, nunca lanza excepciones, siempre devuelve un objeto tipado
 * { success, message, data?, errors? } incluso en el catch.
 */

export type { ServiceResult };

export interface Pregunta {
  id: string;
  enunciado: string;
  alternativas: { A: string; B: string; C: string };
  competenciaId: string;
}

export interface DiagnosticoCreado {
  diagnostico: {
    id: string;
    estado: "en_progreso" | "completado";
    fecha: string;
    usuarioId: string;
    nivelEspecialidadId: string;
  };
  preguntas: Pregunta[];
}

export interface RespuestaGuardada {
  preguntaId: string;
  guardada: boolean;
}

export interface SimulacionResultado {
  diagnosticoId: string;
  preguntasSimuladas: number;
  patronUsado: Record<string, number>;
}

export interface ReporteCompetencia {
  competencia: string;
  correctas: number;
  total: number;
  porcentaje: number;
}

export interface ReporteFinal {
  diagnosticoId: string;
  estado: "completado";
  reporte: ReporteCompetencia[];
  resumen: {
    correctasTotal: number;
    totalPreguntas: number;
    porcentajeTotal: number;
  };
}

export async function crearDiagnostico(): Promise<
  ServiceResult<DiagnosticoCreado>
> {
  return callApi(() => api.post<DiagnosticoCreado>("/diagnostico"));
}

export async function responderPregunta(
  diagnosticoId: string,
  preguntaId: string,
  alternativaElegida: "A" | "B" | "C",
): Promise<ServiceResult<RespuestaGuardada>> {
  return callApi(() =>
    api.post<RespuestaGuardada>(`/diagnostico/${diagnosticoId}/responder`, {
      preguntaId,
      alternativaElegida,
    }),
  );
}

export async function simularDiagnostico(
  diagnosticoId: string,
): Promise<ServiceResult<SimulacionResultado>> {
  return callApi(() =>
    api.post<SimulacionResultado>(`/diagnostico/${diagnosticoId}/simular`, {}),
  );
}

export async function finalizarDiagnostico(
  diagnosticoId: string,
): Promise<ServiceResult<ReporteFinal>> {
  return callApi(() =>
    api.post<ReporteFinal>(`/diagnostico/${diagnosticoId}/finalizar`),
  );
}
