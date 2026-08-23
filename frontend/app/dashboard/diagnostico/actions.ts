"use server";

import { redirect } from "next/navigation";
import { updateSession } from "@/lib/session";
import {
  crearDiagnostico,
  finalizarDiagnostico,
  responderPregunta,
  simularDiagnostico,
  type DiagnosticoCreado,
  type RespuestaGuardada,
  type ServiceResult,
  type SimulacionResultado,
} from "@/services/diagnostico.service";

export async function crearDiagnosticoAction(): Promise<
  ServiceResult<DiagnosticoCreado>
> {
  const result = await crearDiagnostico();
  if (result.success && result.data) {
    await updateSession({
      diagnostico: { id: result.data.diagnostico.id, estado: "en_progreso" },
    });
  }
  return result;
}

export async function responderPreguntaAction(
  diagnosticoId: string,
  preguntaId: string,
  alternativaElegida: "A" | "B" | "C",
): Promise<ServiceResult<RespuestaGuardada>> {
  return responderPregunta(diagnosticoId, preguntaId, alternativaElegida);
}

/**
 * Si el backend responde 404 (DEMO_MODE=false), se recuerda en la sesión
 * para que el botón "Simular respuestas" no vuelva a aparecer en próximas
 * cargas de esta sesión. Si simula con éxito, finaliza el diagnóstico acá
 * mismo (las cookies solo pueden escribirse en una Server Action o Route
 * Handler, nunca durante el render de la página de reporte) y redirige
 * directo al reporte, saltando las 60 preguntas individuales.
 */
export async function simularDiagnosticoAction(
  diagnosticoId: string,
): Promise<ServiceResult<SimulacionResultado>> {
  const result = await simularDiagnostico(diagnosticoId);

  if (result.notFound) {
    await updateSession({ demoModeOff: true });
    return result;
  }

  if (!result.success) {
    return result;
  }

  const finalResult = await finalizarDiagnostico(diagnosticoId);
  if (!finalResult.success) {
    return { ...finalResult, data: undefined };
  }

  await updateSession({
    diagnostico: { id: diagnosticoId, estado: "completado" },
  });
  redirect("/dashboard/reporte");
}

export async function finalizarDiagnosticoAction(
  diagnosticoId: string,
): Promise<ServiceResult<never>> {
  const result = await finalizarDiagnostico(diagnosticoId);

  if (!result.success) {
    return result as ServiceResult<never>;
  }

  await updateSession({
    diagnostico: { id: diagnosticoId, estado: "completado" },
  });
  redirect("/dashboard/reporte");
}
