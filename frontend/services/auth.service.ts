"use server";

import { ApiError, api } from "@/lib/api";

/**
 * Capa de servicios (docs/arquitectura-base.md §5.3): una función por
 * operación, nunca lanza excepciones, siempre devuelve un objeto tipado
 * { success, message, data?, errors? } incluso en el catch.
 */

export interface AuthUser {
  id: string;
  email: string;
  nombre: string;
  nivelEspecialidadId: string;
  createdAt: string;
}

export interface AuthResponseData {
  user: AuthUser;
  accessToken: string;
}

export interface ServiceResult<T> {
  success: boolean;
  message: string;
  data?: T;
  errors?: string[];
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  email: string;
  password: string;
  nombre: string;
  nivelEspecialidadId: string;
}

async function callAuthEndpoint(
  path: string,
  dto: LoginDto | RegisterDto,
): Promise<ServiceResult<AuthResponseData>> {
  try {
    const data = await api.post<AuthResponseData>(path, dto);
    return { success: true, message: "OK", data };
  } catch (error) {
    if (error instanceof ApiError) {
      return { success: false, message: error.message, errors: error.errors };
    }
    return {
      success: false,
      message: "No se pudo conectar con el servidor. Intenta de nuevo.",
    };
  }
}

export async function login(
  dto: LoginDto,
): Promise<ServiceResult<AuthResponseData>> {
  return callAuthEndpoint("/auth/login", dto);
}

export async function register(
  dto: RegisterDto,
): Promise<ServiceResult<AuthResponseData>> {
  return callAuthEndpoint("/auth/register", dto);
}
