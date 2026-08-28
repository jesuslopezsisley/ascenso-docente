import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { obtenerRespuestasDiagnostico } from "@/services/diagnostico.service";
import { RevisarClient } from "./revisar-client";

export const metadata: Metadata = {
  title: "Revisar respuestas — Ascenso Docente",
};

function SinDiagnostico({ mensaje }: { mensaje: string }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm font-medium tracking-wide text-accent uppercase">
        Revisar respuestas
      </p>
      <h1 className="max-w-lg font-serif text-3xl text-foreground">{mensaje}</h1>
      <Link
        href="/dashboard/diagnostico"
        className="mt-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        Ir al diagnóstico
      </Link>
    </main>
  );
}

export default async function RevisarPage({
  searchParams,
}: PageProps<"/dashboard/revisar">) {
  // El layout de /dashboard ya garantiza que hay sesión.
  const [{ diagnostico }, session] = await Promise.all([
    searchParams,
    getSession(),
  ]);

  const idDesdeUrl = typeof diagnostico === "string" ? diagnostico : undefined;
  const desdeHistorial = idDesdeUrl !== undefined;
  const diagnosticoId = idDesdeUrl ?? session?.diagnostico?.id;

  if (!diagnosticoId) {
    return (
      <SinDiagnostico mensaje="Todavía no tienes un diagnóstico para revisar" />
    );
  }
  if (!desdeHistorial && session?.diagnostico?.estado !== "completado") {
    return (
      <SinDiagnostico mensaje="Primero termina tu diagnóstico para poder revisarlo" />
    );
  }

  const res = await obtenerRespuestasDiagnostico(diagnosticoId);

  if (!res.success || !res.data) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-6 py-12">
        <h1 className="font-serif text-3xl text-foreground">
          No se pudieron cargar tus respuestas
        </h1>
        <p className="text-sm text-muted-foreground">{res.message}</p>
        <Link
          href={desdeHistorial ? "/dashboard/historial" : "/dashboard"}
          className="self-start rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          {desdeHistorial ? "Volver al historial" : "Volver al inicio"}
        </Link>
      </main>
    );
  }

  return (
    <RevisarClient respuestas={res.data} desdeHistorial={desdeHistorial} />
  );
}
