import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex flex-col items-center gap-4">
        <p className="text-sm font-medium tracking-wide text-accent uppercase">
          Ascenso Docente
        </p>
        <h1 className="max-w-2xl font-serif text-4xl leading-tight text-foreground sm:text-5xl">
          Diagnóstico y plan de estudio para el examen de ascenso magisterial
        </h1>
        <p className="max-w-md text-muted-foreground">
          Base del proyecto en construcción.
        </p>
      </div>

      <div className="flex gap-3">
        <Link
          href="/login"
          className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Ingresar
        </Link>
        <Link
          href="/registro"
          className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          Crear cuenta
        </Link>
      </div>
    </main>
  );
}
