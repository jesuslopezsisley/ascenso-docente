import type { Metadata } from "next";
import { Proximamente } from "../proximamente";

export const metadata: Metadata = {
  title: "Historial — Ascenso Docente",
};

export default function HistorialPage() {
  return (
    <Proximamente
      seccion="Historial"
      descripcion="Acá vas a ver tus diagnósticos anteriores con su fecha y puntaje. El backend todavía no guarda ni lista un historial de diagnósticos."
    />
  );
}
