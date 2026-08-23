"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registroAction, type RegistroFormState } from "./actions";
import { TextField } from "@/components/text-field";
import { FormError } from "@/components/form-error";
import type { NivelEspecialidad } from "@/services/nivel-especialidad.service";

const initialState: RegistroFormState = {};

export function RegistroForm({ niveles }: { niveles: NivelEspecialidad[] }) {
  const [state, formAction, pending] = useActionState(
    registroAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormError message={state.error} />

      <TextField
        label="Nombre completo"
        name="nombre"
        type="text"
        autoComplete="name"
        defaultValue={state.values?.nombre}
        required
      />
      <TextField
        label="Correo electrónico"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={state.values?.email}
        required
      />
      <TextField
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
      />

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="nivelEspecialidadId"
          className="text-sm font-medium text-foreground"
        >
          Especialidad a la que postulas
        </label>
        <select
          id="nivelEspecialidadId"
          name="nivelEspecialidadId"
          defaultValue={state.values?.nivelEspecialidadId ?? niveles[0]?.id}
          required
          disabled={niveles.length === 0}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-60"
        >
          {niveles.map((nivel) => (
            <option key={nivel.id} value={nivel.id}>
              {nivel.nombre}
            </option>
          ))}
        </select>
        {niveles.length === 0 ? (
          <FormError message="No se pudieron cargar las especialidades disponibles. Intenta recargar la página." />
        ) : null}
      </div>

      <button
        type="submit"
        disabled={pending || niveles.length === 0}
        className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Creando cuenta…" : "Crear cuenta"}
      </button>

      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-medium text-primary">
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}
