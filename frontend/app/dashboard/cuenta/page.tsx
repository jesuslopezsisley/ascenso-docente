import type { Metadata } from "next";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Mi cuenta — Ascenso Docente",
};

export default async function CuentaPage() {
  // El layout de /dashboard ya garantiza que hay sesión.
  const session = await getSession();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <header className="flex flex-col gap-1">
        <p className="text-sm font-medium tracking-wide text-accent uppercase">
          Mi cuenta
        </p>
        <h1 className="font-serif text-3xl text-foreground">Datos de tu cuenta</h1>
      </header>

      <dl className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-col gap-1 border-b border-border pb-4">
          <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Nombre
          </dt>
          <dd className="text-sm text-foreground">{session?.user.nombre}</dd>
        </div>
        <div className="flex flex-col gap-1 pt-4">
          <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Correo electrónico
          </dt>
          <dd className="text-sm text-foreground">{session?.user.email}</dd>
        </div>
      </dl>

      <p className="text-xs text-muted-foreground">
        Editar estos datos y cambiar la contraseña estará disponible
        próximamente.
      </p>
    </main>
  );
}
