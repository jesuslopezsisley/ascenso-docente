export interface ConteoCompetencia {
  competenciaId: string;
  total: number;
}

/**
 * Reparte `totalObjetivo` cupos entre competencias en proporción a cuántas
 * preguntas tiene cada una en el banco acumulado (todos los años sembrados),
 * usando el método de mayores restos (Hamilton) para que la suma redondeada
 * dé exactamente `totalObjetivo`. Si una competencia no tiene suficientes
 * preguntas para cubrir su cupo ideal, se le asignan todas las que tiene y
 * el faltante se reparte proporcionalmente entre las competencias restantes
 * (recalculando en cada iteración) — es dinámico: no depende de cuántas
 * competencias ni cuántos años de preguntas existan, solo de los conteos
 * que se le pasen.
 */
export function calcularCuposPorCompetencia(
  conteos: ConteoCompetencia[],
  totalObjetivo: number,
): Map<string, number> {
  const cupos = new Map<string, number>();
  let pendientes = conteos.filter((c) => c.total > 0);
  let objetivoRestante = totalObjetivo;

  while (pendientes.length > 0 && objetivoRestante > 0) {
    const totalDisponible = pendientes.reduce((suma, c) => suma + c.total, 0);

    // El banco completo no alcanza para llenar lo que falta: se usa todo.
    if (totalDisponible <= objetivoRestante) {
      for (const c of pendientes) cupos.set(c.competenciaId, c.total);
      objetivoRestante -= totalDisponible;
      pendientes = [];
      break;
    }

    const conPiso = pendientes.map((c) => {
      const crudo = (c.total / totalDisponible) * objetivoRestante;
      return {
        competenciaId: c.competenciaId,
        total: c.total,
        crudo,
        piso: Math.floor(crudo),
      };
    });
    const asignado = conPiso.reduce((suma, c) => suma + c.piso, 0);
    const sinAsignar = objetivoRestante - asignado;

    // Reparte las unidades sobrantes por mayor parte fraccionaria; los
    // empates se desempatan por competenciaId para que el resultado sea
    // determinista (la aleatoriedad real está en qué preguntas se eligen
    // dentro de cada competencia, no en cuántos cupos le tocan).
    const ordenPorResto = [...conPiso].sort((a, b) => {
      const restoA = a.crudo - a.piso;
      const restoB = b.crudo - b.piso;
      if (restoB !== restoA) return restoB - restoA;
      return a.competenciaId.localeCompare(b.competenciaId);
    });
    for (let i = 0; i < sinAsignar; i++) {
      ordenPorResto[i].piso += 1;
    }

    const sobrepasadas = conPiso.filter((c) => c.piso > c.total);
    if (sobrepasadas.length === 0) {
      for (const c of conPiso) cupos.set(c.competenciaId, c.piso);
      objetivoRestante = 0;
      pendientes = [];
      break;
    }

    // Alguna competencia quedó con un cupo redondeado mayor a lo que tiene
    // disponible: se fija en su máximo y se recalcula el resto solo entre
    // las competencias que aún no llegaron a su tope.
    for (const c of sobrepasadas) {
      cupos.set(c.competenciaId, c.total);
      objetivoRestante -= c.total;
    }
    const idsFijadas = new Set(sobrepasadas.map((c) => c.competenciaId));
    pendientes = pendientes.filter((c) => !idsFijadas.has(c.competenciaId));
  }

  return cupos;
}

/** Fisher-Yates parcial: elige `cantidad` elementos al azar sin repetir. */
export function elegirAlAzar<T>(items: T[], cantidad: number): T[] {
  const copia = [...items];
  const limite = Math.min(cantidad, copia.length);
  for (let i = 0; i < limite; i++) {
    const j = i + Math.floor(Math.random() * (copia.length - i));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia.slice(0, limite);
}
