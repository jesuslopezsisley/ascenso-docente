"use server";

import { ApiError, api } from "@/lib/api";

/**
 * Capa de servicios (docs/arquitectura-base.md §5.3): una función por
 * operación, nunca lanza excepciones, siempre devuelve un objeto tipado
 * { success, message, data?, errors? } incluso en el catch.
 */

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

export interface ServiceResult<T> {
  success: boolean;
  message: string;
  data?: T;
  errors?: string[];
  /** true si el backend respondió 404 (p. ej. DEMO_MODE=false en /simular). */
  notFound?: boolean;
}

async function callDiagnosticoEndpoint<T>(
  fn: () => Promise<T>,
): Promise<ServiceResult<T>> {
  try {
    const data = await fn();
    return { success: true, message: "OK", data };
  } catch (error) {
    if (error instanceof ApiError) {
      return {
        success: false,
        message: error.message,
        errors: error.errors,
        notFound: error.status === 404,
      };
    }
    return {
      success: false,
      message: "No se pudo conectar con el servidor. Intenta de nuevo.",
    };
  }
}

export async function crearDiagnostico(): Promise<
  ServiceResult<DiagnosticoCreado>
> {
  return callDiagnosticoEndpoint(() =>
    api.post<DiagnosticoCreado>("/diagnostico"),
  );
}

export async function responderPregunta(
  diagnosticoId: string,
  preguntaId: string,
  alternativaElegida: "A" | "B" | "C",
): Promise<ServiceResult<RespuestaGuardada>> {
  return callDiagnosticoEndpoint(() =>
    api.post<RespuestaGuardada>(`/diagnostico/${diagnosticoId}/responder`, {
      preguntaId,
      alternativaElegida,
    }),
  );
}

export async function simularDiagnostico(
  diagnosticoId: string,
): Promise<ServiceResult<SimulacionResultado>> {
  return callDiagnosticoEndpoint(() =>
    api.post<SimulacionResultado>(`/diagnostico/${diagnosticoId}/simular`, {}),
  );
}

export async function finalizarDiagnostico(
  diagnosticoId: string,
): Promise<ServiceResult<ReporteFinal>> {
  return callDiagnosticoEndpoint(() =>
    api.post<ReporteFinal>(`/diagnostico/${diagnosticoId}/finalizar`),
  );
}
