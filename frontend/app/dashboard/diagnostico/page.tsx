import type { Metadata } from "next";
import { getSession } from "@/lib/session";
import { DiagnosticoClient } from "./diagnostico-client";

export const metadata: Metadata = {
  title: "Diagnóstico — Ascenso Docente",
};

export default async function DiagnosticoPage() {
  // El layout de /dashboard ya garantiza que hay sesión.
  const session = await getSession();

  return (
    <DiagnosticoClient
      diagnosticoActivo={session?.diagnostico ?? null}
      demoModeOffInicial={session?.demoModeOff ?? false}
    />
  );
}
