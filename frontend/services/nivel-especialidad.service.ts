"use server";

import { api } from "@/lib/api";
import { callApi, type ServiceResult } from "@/lib/service-result";

export type { ServiceResult };

export interface NivelEspecialidad {
  id: string;
  nivel: string;
  especialidad: string;
  nombre: string;
}

export async function listarNivelesEspecialidad(): Promise<
  ServiceResult<NivelEspecialidad[]>
> {
  return callApi(() => api.get<NivelEspecialidad[]>("/nivel-especialidad"));
}
