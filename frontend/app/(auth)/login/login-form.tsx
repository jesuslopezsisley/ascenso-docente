"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction, type LoginFormState } from "./actions";
import { TextField } from "@/components/text-field";
import { FormError } from "@/components/form-error";

const initialState: LoginFormState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(
    loginAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormError message={state.error} />

      <TextField
        label="Correo electrónico"
        name="email"
        type="email"
        autoComplete="email"
        required
      />
      <TextField
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Ingresando…" : "Ingresar"}
      </button>

      <p className="text-center text-sm text-muted-foreground">
        ¿No tienes cuenta?{" "}
        <Link href="/registro" className="font-medium text-primary">
          Regístrate
        </Link>
      </p>
    </form>
  );
}
