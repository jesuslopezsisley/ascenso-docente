import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const NIVEL_ESPECIALIDAD = {
  nivel: "EBR",
  especialidad: "Primaria",
  nombre: "EBR Primaria",
};

const COMPETENCIAS_PEDAGOGICAS_GENERALES = [
  "comprension_produccion_textos",
  "indagacion_cientifica",
  "resolucion_problemas_matematicos",
  "convivencia_tutoria_socioemocional",
  "ciencias_sociales_ciudadania",
  "retroalimentacion_acompanamiento",
  "enfoque_inclusivo",
  "evaluacion_formativa",
] as const;

const TIPO_COMPETENCIA = "pedagógica_general";

// Copias autocontenidas dentro de backend/ (no dependen de docs/, que vive
// fuera del Root Directory que Railway despliega). Los originales en
// docs/seed-preguntas-primaria-<anio>.json siguen siendo la fuente de verdad
// para el trabajo de clasificación; si se reclasifica algo ahí, hay que
// volver a copiarlo acá. Cada cuadernillo nuevo (nuevo año) se agrega como
// una entrada más en esta lista — el seed es reiniciable y siempre reinserta
// TODOS los años listados aquí, así que agregar 2020 no borra 2018/2019.
const PREGUNTAS_JSON_PATHS = [
  path.join(__dirname, "seed-preguntas-primaria-2018.json"),
  path.join(__dirname, "seed-preguntas-primaria-2019.json"),
  path.join(__dirname, "seed-preguntas-primaria-2021.json"),
  path.join(__dirname, "seed-preguntas-primaria-2022.json"),
  path.join(__dirname, "seed-preguntas-primaria-2023.json"),
  path.join(__dirname, "seed-preguntas-primaria-2024.json"),
];

interface PreguntaSeed {
  enunciado: string;
  alternativas: { A: string; B: string; C: string };
  respuestaCorrecta: "A" | "B" | "C";
  competencia: (typeof COMPETENCIAS_PEDAGOGICAS_GENERALES)[number];
  fuente: string;
  anio: number;
}

function leerPreguntas(): PreguntaSeed[] {
  const preguntas = PREGUNTAS_JSON_PATHS.flatMap((rutaJson) => {
    const raw = fs.readFileSync(rutaJson, "utf-8");
    return JSON.parse(raw) as PreguntaSeed[];
  });

  for (const [i, p] of preguntas.entries()) {
    if (!COMPETENCIAS_PEDAGOGICAS_GENERALES.includes(p.competencia)) {
      throw new Error(
        `Pregunta #${i + 1} tiene una competencia desconocida: "${p.competencia}"`,
      );
    }
    if (!["A", "B", "C"].includes(p.respuestaCorrecta)) {
      throw new Error(
        `Pregunta #${i + 1} tiene una respuestaCorrecta inválida: "${p.respuestaCorrecta}"`,
      );
    }
    if (!Number.isInteger(p.anio)) {
      throw new Error(`Pregunta #${i + 1} tiene un anio inválido: "${p.anio}"`);
    }
  }

  return preguntas;
}

async function main() {
  console.log(`Leyendo preguntas desde ${PREGUNTAS_JSON_PATHS.length} archivo(s)...`);
  const preguntas = leerPreguntas();
  console.log(`  ${preguntas.length} preguntas encontradas en total.`);

  const nivelEspecialidad = await prisma.nivelEspecialidad.upsert({
    where: { nombre: NIVEL_ESPECIALIDAD.nombre },
    update: {
      nivel: NIVEL_ESPECIALIDAD.nivel,
      especialidad: NIVEL_ESPECIALIDAD.especialidad,
    },
    create: NIVEL_ESPECIALIDAD,
  });
  console.log(`NivelEspecialidad listo: ${nivelEspecialidad.nombre}`);

  const competenciaPorNombre = new Map<string, string>();
  for (const nombre of COMPETENCIAS_PEDAGOGICAS_GENERALES) {
    const competencia = await prisma.competencia.upsert({
      where: { nombre },
      update: { tipo: TIPO_COMPETENCIA },
      create: { nombre, tipo: TIPO_COMPETENCIA },
    });
    competenciaPorNombre.set(nombre, competencia.id);
  }
  console.log(
    `${competenciaPorNombre.size} competencias pedagógicas generales listas.`,
  );

  // El seed es reiniciable: se limpian las preguntas de esta NivelEspecialidad
  // antes de reinsertarlas, para que correr el script varias veces no duplique datos.
  const { count: eliminadas } = await prisma.pregunta.deleteMany({
    where: { nivelEspecialidadId: nivelEspecialidad.id },
  });
  if (eliminadas > 0) {
    console.log(`Se eliminaron ${eliminadas} preguntas previas antes de reinsertar.`);
  }

  const data = preguntas.map((p) => {
    const competenciaId = competenciaPorNombre.get(p.competencia);
    if (!competenciaId) {
      throw new Error(`No se encontró la competencia "${p.competencia}"`);
    }
    return {
      enunciado: p.enunciado,
      alternativas: p.alternativas,
      respuestaCorrecta: p.respuestaCorrecta,
      fuente: p.fuente,
      anio: p.anio,
      competenciaId,
      nivelEspecialidadId: nivelEspecialidad.id,
    };
  });

  const { count: insertadas } = await prisma.pregunta.createMany({ data });
  console.log(`${insertadas} preguntas insertadas.`);

  const [totalNiveles, totalCompetencias, totalPreguntas] = await Promise.all([
    prisma.nivelEspecialidad.count(),
    prisma.competencia.count(),
    prisma.pregunta.count(),
  ]);

  console.log("\nConteo final de registros por tabla:");
  console.log(`  NivelEspecialidad: ${totalNiveles}`);
  console.log(`  Competencia:       ${totalCompetencias}`);
  console.log(`  Pregunta:          ${totalPreguntas}`);
}

main()
  .catch((error) => {
    console.error("Error al ejecutar el seed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
