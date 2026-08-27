import Link from "next/link";

/**
 * Pantalla de relleno para secciones cuya API todavía no existe en el
 * backend. El enlace del menú puede apuntar acá (o quedar deshabilitado);
 * en cualquier caso, entrar por URL directa no rompe.
 */
export function Proximamente({
  seccion,
  descripcion,
}: {
  seccion: string;
  descripcion: string;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm font-medium tracking-wide text-accent uppercase">
        {seccion}
      </p>
      <h1 className="max-w-lg font-serif text-3xl text-foreground">
        Próximamente
      </h1>
      <p className="max-w-md text-sm text-muted-foreground">{descripcion}</p>
      <Link
        href="/dashboard"
        className="mt-2 rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
      >
        Volver al inicio
      </Link>
    </main>
  );
}
