"use server";

import { redirect } from "next/navigation";
import { destroySession } from "@/lib/session";

/**
 * Cierra la sesión del frontend (borra la cookie firmada) y manda al login.
 * Las cookies solo pueden mutarse desde una Server Action o Route Handler,
 * de ahí que esto viva acá y no en el componente del shell.
 */
export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
