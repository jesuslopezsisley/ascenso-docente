export const COMPETENCIAS_PEDAGOGICAS = [
  'comprension_produccion_textos',
  'indagacion_cientifica',
  'resolucion_problemas_matematicos',
  'convivencia_tutoria_socioemocional',
  'ciencias_sociales_ciudadania',
  'retroalimentacion_acompanamiento',
  'enfoque_inclusivo',
  'evaluacion_formativa',
] as const;

export type CompetenciaNombre = (typeof COMPETENCIAS_PEDAGOGICAS)[number];

/**
 * Patrón de aciertos usado por /diagnostico/:id/simular cuando no se envía
 * un patrón explícito: falla la mayoría en resolucion_problemas_matematicos
 * e indagacion_cientifica, y le va bien en el resto.
 */
export const PATRON_SIMULACION_POR_DEFECTO: Record<CompetenciaNombre, number> =
  {
    comprension_produccion_textos: 90,
    indagacion_cientifica: 25,
    resolucion_problemas_matematicos: 25,
    convivencia_tutoria_socioemocional: 90,
    ciencias_sociales_ciudadania: 85,
    retroalimentacion_acompanamiento: 90,
    enfoque_inclusivo: 90,
    evaluacion_formativa: 85,
  };
