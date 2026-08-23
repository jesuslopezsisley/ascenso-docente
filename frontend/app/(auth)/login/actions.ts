"use server";

import { redirect } from "next/navigation";
import { createSession } from "@/lib/session";
import { login } from "@/services/auth.service";

export interface LoginFormState {
  error?: string;
  values?: { email: string };
}

export async function loginAction(
  _prevState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  // React resetea el <form> a sus defaultValue tras cada Server Action; se
  // devuelve el email (nunca la contraseña) para volver a prellenarlo.
  const values = { email };

  if (!email || !password) {
    return { error: "Ingresa tu correo y tu contraseña.", values };
  }

  const result = await login({ email, password });

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
