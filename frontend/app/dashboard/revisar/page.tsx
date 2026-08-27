import type { Metadata } from "next";
import { Proximamente } from "../proximamente";

export const metadata: Metadata = {
  title: "Revisar respuestas — Ascenso Docente",
};

export default function RevisarPage() {
  return (
    <Proximamente
      seccion="Revisar respuestas"
      descripcion="Acá vas a poder repasar pregunta por pregunta qué respondiste y cuál era la alternativa correcta. El backend todavía no expone ese detalle; por ahora el reporte muestra el resultado por competencia."
    />
  );
}
