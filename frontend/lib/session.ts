import "server-only";

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

/**
 * Cookie de sesión propia del frontend, firmada con un secreto distinto del
 * JWT_SECRET del backend (docs/arquitectura-base.md §5.2). La cookie envuelve
 * el accessToken del backend; no lo reemplaza. El backend actual emite un JWT
 * simple sin refresh token, así que a diferencia del proyecto de referencia
 * no hay refreshToken/expiresAt que rotar acá.
 */

const SESSION_COOKIE_NAME = "ad_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 días, igual que el JWT del backend

export interface SessionUser {
  id: string;
  email: string;
  nombre: string;
  nivelEspecialidadId: string;
}

export interface SessionPayload {
  user: SessionUser;
  accessToken: string;
}

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET no está configurado");
  }
  return new TextEncoder().encode(secret);
}

/** Solo puede llamarse desde un Server Function o Route Handler. */
export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/** Se puede llamar desde Server Components, Server Functions y Route Handlers. */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (
      typeof payload !== "object" ||
      payload === null ||
      typeof payload.accessToken !== "string" ||
      typeof payload.user !== "object" ||
      payload.user === null
    ) {
      return null;
    }
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/** Solo puede llamarse desde un Server Function o Route Handler. */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
