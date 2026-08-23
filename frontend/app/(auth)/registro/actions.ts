"use server";

import { redirect } from "next/navigation";
import { createSession } from "@/lib/session";
import { register } from "@/services/auth.service";

export interface RegistroFormState {
  error?: string;
  values?: { email: string; nombre: string; nivelEspecialidadId: string };
}

export async function registroAction(
  _prevState: RegistroFormState,
  formData: FormData,
): Promise<RegistroFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const nivelEspecialidadId = String(
    formData.get("nivelEspecialidadId") ?? "",
  );

  // React resetea el <form> a sus defaultValue tras cada Server Action; se
  // devuelven los campos no sensibles (nunca la contraseña) para prellenarlos.
  const values = { email, nombre, nivelEspecialidadId };

  if (!email || !password || !nombre || !nivelEspecialidadId) {
    return { error: "Completa todos los campos.", values };
  }

  const result = await register({ email, password, nombre, nivelEspecialidadId });

  if (!result.success || !result.data) {
    const detalle =
      result.errors && result.errors.length > 0
        ? result.errors.join(" ")
        : result.message;
    return { error: detalle, values };
  }

  await createSession({
    user: result.data.user,
    accessToken: result.data.accessToken,
  });

  redirect("/dashboard");
}
