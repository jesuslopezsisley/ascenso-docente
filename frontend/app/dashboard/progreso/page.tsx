import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { obtenerProgreso } from "@/services/plan-estudio.service";

export const metadata: Metadata = {
  title: "Mi progreso — Ascenso Docente",
};

export default async function ProgresoPage() {
  // El layout de /dashboard ya garantiza que hay sesión.
  const session = await getSession();
  const diagnostico = session?.diagnostico;

  if (!diagnostico || diagnostico.estado !== "completado") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm font-medium tracking-wide text-accent uppercase">
          Mi progreso
        </p>
        <h1 className="max-w-lg font-serif text-3xl text-foreground">
          Todavía no hay progreso que mostrar
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          El progreso se mide sobre las sesiones de tu plan de estudio, y el
          plan se genera cuando terminas el diagnóstico.
        </p>
        <Link
          href="/dashboard/diagnostico"
          className="mt-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Ir al diagnóstico
        </Link>
      </main>
    );
  }

  const progreso = await obtenerProgreso(diagnostico.id);

  if (progreso.notFound || !progreso.success || !progreso.data) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm font-medium tracking-wide text-accent uppercase">
          Mi progreso
        </p>
        <h1 className="max-w-lg font-serif text-3xl text-foreground">
          Aún no generas tu plan de estudio
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          {progreso.notFound || progreso.success
            ? "Genera tu plan para empezar a marcar sesiones y ver tu avance acá."
            : progreso.message}
        </p>
        <Link
          href="/dashboard/plan-estudio"
          className="mt-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Ir a mi plan de estudio
        </Link>
      </main>
    );
  }

  const { completadas, totalSesiones, porcentaje } = progreso.data;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <header className="flex flex-col gap-1">
        <p className="text-sm font-medium tracking-wide text-accent uppercase">
          Mi progreso
        </p>
        <h1 className="font-serif text-3xl text-foreground">
          Tu avance en el plan de estudio
        </h1>
      </header>

      <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <p className="font-serif text-4xl text-foreground">{porcentaje}%</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {completadas} de {totalSesiones} sesiones completadas
        </p>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${porcentaje}%` }}
          />
        </div>
      </section>

      <Link
        href="/dashboard/plan-estudio"
        className="self-start rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        Ver mi plan de estudio
      </Link>
    </main>
  );
}
