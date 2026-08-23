import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Inicio — Ascenso Docente",
};

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
      <p className="text-sm font-medium tracking-wide text-accent uppercase">
        Ascenso Docente
      </p>
      <h1 className="font-serif text-3xl text-foreground">
        Hola, {session.user.nombre}
      </h1>
      <p className="text-muted-foreground">{session.user.email}</p>
      <p className="mt-4 max-w-md text-sm text-muted-foreground">
        Pantalla de inicio en construcción.
      </p>
    </main>
  );
}
