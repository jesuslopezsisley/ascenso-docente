import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/session";
import {
  listarDiagnosticos,
  type DiagnosticoHistorial,
} from "@/services/diagnostico.service";

export const metadata: Metadata = {
  title: "Historial — Ascenso Docente",
};

const fmtFecha = new Intl.DateTimeFormat("es-PE", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function HistorialPage() {
  // El layout de /dashboard ya garantiza que hay sesión.
  const [session, res] = await Promise.all([getSession(), listarDiagnosticos()]);
  const activoId = session?.diagnostico?.id;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <header className="flex flex-col gap-1">
        <p className="text-sm font-medium tracking-wide text-accent uppercase">
          Historial
        </p>
        <h1 className="font-serif text-3xl text-foreground">
          Tus diagnósticos
        </h1>
      </header>

      {!res.success ? (
        <p className="rounded-xl border border-border bg-surface p-6 text-sm text-muted-foreground shadow-sm">
          No se pudo cargar tu historial. {res.message}
        </p>
      ) : (res.data ?? []).length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-surface p-6 shadow-sm">
          <p className="text-sm text-muted-foreground">
            Todavía no has hecho ningún diagnóstico.
          </p>
          <Link
            href="/dashboard/diagnostico"
            className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Empezar mi diagnóstico
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {(res.data ?? []).map((d) => (
            <HistorialItem
              key={d.id}
              diagnostico={d}
              esActivo={d.id === activoId}
            />
          ))}
        </ul>
      )}
    </main>
  );
}

function HistorialItem({
  diagnostico,
  esActivo,
}: {
  diagnostico: DiagnosticoHistorial;
  esActivo: boolean;
}) {
  const { id, fecha, estado, puntaje } = diagnostico;
  const completado = estado === "completado";

  const contenido = (
    <>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">
          {fmtFecha.format(new Date(fecha))}
        </p>
        <p className="text-xs text-muted-foreground">
          {completado ? "Completado" : "En progreso"}
          {esActivo ? " · activo" : ""}
        </p>
      </div>
      <div className="flex items-center gap-3">
        {completado ? (
          <span className="font-serif text-2xl text-foreground">
            {puntaje}%
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
        {completado ? (
          <span className="text-sm font-medium text-primary">Ver reporte →</span>
        ) : null}
      </div>
    </>
  );

  if (completado) {
    return (
      <li>
        <Link
          href={`/dashboard/reporte?diagnostico=${id}`}
          className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm transition-colors hover:bg-muted"
        >
          {contenido}
        </Link>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm">
      {contenido}
    </li>
  );
}
