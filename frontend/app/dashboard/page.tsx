import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Inicio — Ascenso Docente",
};

export default async function DashboardPage() {
  // El layout de /dashboard ya garantiza que hay sesión; getSession() no
  // debería devolver null acá.
  const session = await getSession();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm font-medium tracking-wide text-accent uppercase">
        Ascenso Docente
      </p>
      <h1 className="font-serif text-3xl text-foreground">
        Hola, {session?.user.nombre}
      </h1>
      <p className="text-muted-foreground">{session?.user.email}</p>

      <Link
        href="/dashboard/diagnostico"
        className="mt-4 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        {session?.diagnostico?.estado === "en_progreso"
          ? "Continuar diagnóstico"
          : "Empezar diagnóstico"}
      </Link>
    </main>
  );
}
