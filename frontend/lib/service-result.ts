import "server-only";

import { ApiError } from "./api";

/**
 * Shape común devuelto por toda función de la capa de services/ (docs/
 * arquitectura-base.md §5.3): nunca lanza, siempre un objeto tipado.
 */
export interface ServiceResult<T> {
  success: boolean;
  message: string;
  data?: T;
  errors?: string[];
  /** true si el backend respondió 404 (p. ej. un recurso aún no existe). */
  notFound?: boolean;
}

export async function callApi<T>(fn: () => Promise<T>): Promise<ServiceResult<T>> {
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
