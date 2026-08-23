import "server-only";

import { getSession } from "./session";

/**
 * Cliente HTTP centralizado hacia el backend. Sigue el shape de respuesta
 * documentado en docs/arquitectura-base.md §6.1: { success, message, data }
 * en éxito, { success: false, error: { message, errors? } } en error.
 *
 * A diferencia de la capa de "services" descrita en §5.3 del documento (que
 * nunca lanza y siempre devuelve un objeto tipado), este cliente de más bajo
 * nivel SÍ lanza ApiError ante success:false — son los futuros
 * `services/<dominio>.service.ts` los que deberán atraparlo y normalizarlo,
 * cuando se construyan las pantallas.
 *
 * Server-only: lee la sesión vía cookies (next/headers), por lo que solo
 * puede usarse desde Server Components, Server Functions o Route Handlers.
 */

interface ApiSuccessBody<T> {
  success: true;
  message: string;
  data: T;
}

interface ApiErrorBody {
  success: false;
  error: { message: string; errors?: string[] };
}

type ApiBody<T> = ApiSuccessBody<T> | ApiErrorBody;

export class ApiError extends Error {
  readonly status: number;
  readonly errors?: string[];

  constructor(message: string, status: number, errors?: string[]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }
}

function getApiUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_API_URL no está configurado");
  }
  return url;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = await getSession();

  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (session?.accessToken) {
    headers.set("Authorization", `Bearer ${session.accessToken}`);
  }

  let response: Response;
  try {
    response = await fetch(`${getApiUrl()}${path}`, { ...init, headers });
  } catch {
    throw new ApiError("No se pudo conectar con el servidor", 0);
  }

  let body: ApiBody<T>;
  try {
    body = (await response.json()) as ApiBody<T>;
  } catch {
    throw new ApiError(
      "El servidor devolvió una respuesta inválida",
      response.status,
    );
  }

  if (!body.success) {
    throw new ApiError(body.error.message, response.status, body.error.errors);
  }

  return body.data;
}

export const api = {
  get: <T>(path: string, init?: RequestInit) =>
    request<T>(path, { ...init, method: "GET" }),
  post: <T>(path: string, data?: unknown, init?: RequestInit) =>
    request<T>(path, {
      ...init,
      method: "POST",
      body: data !== undefined ? JSON.stringify(data) : undefined,
    }),
  patch: <T>(path: string, data?: unknown, init?: RequestInit) =>
    request<T>(path, {
      ...init,
      method: "PATCH",
      body: data !== undefined ? JSON.stringify(data) : undefined,
    }),
  delete: <T>(path: string, init?: RequestInit) =>
    request<T>(path, { ...init, method: "DELETE" }),
};
