"use server";

import { api } from "@/lib/api";
import { callApi, type ServiceResult } from "@/lib/service-result";

/**
 * Capa de servicios (docs/arquitectura-base.md §5.3): una función por
 * operación, nunca lanza excepciones, siempre devuelve un objeto tipado
 * { success, message, data?, errors? } incluso en el catch.
 */

export type { ServiceResult };

export interface SesionPlanEstudio {
  id: string;
  semana: number;
  competencia: string;
  tema: string;
  quePracticar: string;
  completada: boolean;
  planEstudioId: string;
}

export interface PlanEstudio {
  id: string;
  semanas: number;
  resumen: string;
  createdAt: string;
  diagnosticoId: string;
  sesiones: SesionPlanEstudio[];
}

export interface ProgresoPlanEstudio {
  totalSesiones: number;
  completadas: number;
  porcentaje: number;
}

/** Tarda ~20s (llamada real a Gemini) y REGENERA el plan si ya existía uno
 * (borra y recrea las sesiones, reiniciando el progreso marcado). */
export async function generarPlanEstudio(
  diagnosticoId: string,
): Promise<ServiceResult<PlanEstudio>> {
  return callApi(() =>
    api.post<PlanEstudio>(`/diagnostico/${diagnosticoId}/plan-estudio`),
  );
}

export async function completarSesion(
  diagnosticoId: string,
  sesionId: string,
): Promise<ServiceResult<SesionPlanEstudio>> {
  return callApi(() =>
    api.post<SesionPlanEstudio>(
      `/diagnostico/${diagnosticoId}/plan-estudio/sesiones/${sesionId}/completar`,
    ),
  );
}

/** 404 (notFound) si el diagnóstico todavía no tiene un plan generado. */
export async function obtenerProgreso(
  diagnosticoId: string,
): Promise<ServiceResult<ProgresoPlanEstudio>> {
  return callApi(() =>
    api.get<ProgresoPlanEstudio>(
      `/diagnostico/${diagnosticoId}/plan-estudio/progreso`,
    ),
  );
}
