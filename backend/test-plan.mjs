// Script standalone para validar el prompt del plan de estudio de forma
// aislada, ANTES de construir cualquier servicio/módulo en src/.
// No forma parte del build de NestJS (vive fuera de src/, es .mjs plano).
//
// Uso: node test-plan.mjs

import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

// gemini-2.0-flash (pedido originalmente) ya no existe: la API responde 404
// y sugiere gemini-3.6-flash, el mismo modelo vigente que usa el resto del
// backend (src/ia/services/gemini.service.ts).
const MODEL = "gemini-3.6-flash";

const reporte = {
  competencias: [
    {
      nombre: "resolucion_problemas_matematicos",
      correctas: 4,
      total: 14,
      porcentaje: 29,
    },
    {
      nombre: "indagacion_cientifica",
      correctas: 3,
      total: 12,
      porcentaje: 25,
    },
    {
      nombre: "comprension_produccion_textos",
      correctas: 11,
      total: 12,
      porcentaje: 92,
    },
    {
      nombre: "ciencias_sociales_ciudadania",
      correctas: 7,
      total: 8,
      porcentaje: 88,
    },
    {
      nombre: "retroalimentacion_acompanamiento",
      correctas: 4,
      total: 4,
      porcentaje: 100,
    },
    { nombre: "enfoque_inclusivo", correctas: 4, total: 4, porcentaje: 100 },
    {
      nombre: "convivencia_tutoria_socioemocional",
      correctas: 3,
      total: 3,
      porcentaje: 100,
    },
    {
      nombre: "evaluacion_formativa",
      correctas: 3,
      total: 3,
      porcentaje: 100,
    },
  ],
};

/**
 * 1 competencia <50% -> 2 semanas, 2-3 <50% -> 4 semanas, 4+ <50% -> 6 semanas.
 * El caso "0 competencias <50%" no está especificado en la regla original;
 * se usa 2 (el mínimo) como default razonable para ese caso.
 */
function calcularSemanas(reporteInput) {
  const debiles = reporteInput.competencias.filter(
    (c) => c.porcentaje < 50,
  ).length;
  if (debiles >= 4) return 6;
  if (debiles >= 2) return 4;
  if (debiles === 1) return 2;
  return 2;
}

function construirPrompt(reporteInput, semanas) {
  return `Eres un asesor pedagógico que diseña planes de estudio para docentes
peruanos que se preparan para el examen de ascenso de escala magisterial (EBR Primaria).

Aquí está el resultado del diagnóstico del docente, con el porcentaje de aciertos
por competencia pedagógica:

${JSON.stringify(reporteInput, null, 2)}

Genera un plan de estudio de EXACTAMENTE ${semanas} semanas. Prioriza las competencias
con menor porcentaje, dedicándoles más sesiones. Las competencias con 100% no necesitan
sesiones (ya están dominadas). Cada sesión debe indicar SOLO el tema y qué practicar
(sin sugerir links, videos, libros ni recursos externos).

Responde ÚNICAMENTE con un JSON válido, sin texto adicional ni markdown, con esta forma exacta:
{
  "semanas": ${semanas},
  "resumen": "una frase breve sobre el enfoque general del plan",
  "sesiones": [
    {
      "semana": 1,
      "competencia": "resolucion_problemas_matematicos",
      "tema": "string breve",
      "quePracticar": "string, 1-2 oraciones concretas y accionables"
    }
  ]
}`;
}

function limpiarYParsear(textoCrudo) {
  let limpio = textoCrudo.trim();
  const fenceMatch = limpio.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenceMatch) {
    limpio = fenceMatch[1].trim();
  }
  return JSON.parse(limpio);
}

const REINTENTABLES = new Set([429, 503]);

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Reintenta con backoff solo ante errores transitorios (429/503 de Google). */
async function llamarModelo(ai, prompt, maxIntentos = 3) {
  for (let intento = 1; intento <= maxIntentos; intento++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: prompt,
      });
      return response.text;
    } catch (e) {
      const reintentable = REINTENTABLES.has(e.status);
      if (!reintentable || intento === maxIntentos) throw e;
      const esperaMs = 2000 * intento;
      console.log(
        `  (intento ${intento} falló con status ${e.status}, reintentando en ${esperaMs}ms...)`,
      );
      await esperar(esperaMs);
    }
  }
}

async function unaCorrida(ai, numero) {
  console.log("\n" + "=".repeat(70));
  console.log(`CORRIDA ${numero}`);
  console.log("=".repeat(70));

  const semanas = calcularSemanas(reporte);
  const prompt = construirPrompt(reporte, semanas);

  console.log(`\nSemanas calculadas: ${semanas}`);

  const textoCrudo = await llamarModelo(ai, prompt);

  console.log("\n--- Respuesta cruda del modelo ---");
  console.log(textoCrudo);

  let parseOk = false;
  let json = null;
  let errorParseo = null;
  try {
    json = limpiarYParsear(textoCrudo);
    parseOk = true;
  } catch (e) {
    errorParseo = e.message;
  }

  console.log("\n--- Verificación ---");
  console.log(`JSON parseó sin error: ${parseOk ? "SÍ" : "NO"}`);
  if (parseOk) {
    const semanasCorrectas = json.semanas === semanas;
    const cantidadSesiones = Array.isArray(json.sesiones)
      ? json.sesiones.length
      : "N/A (sesiones no es un array)";
    console.log(
      `semanas esperadas: ${semanas} | semanas en respuesta: ${json.semanas} | correcto: ${
        semanasCorrectas ? "SÍ" : "NO"
      }`,
    );
    console.log(`cantidad de sesiones: ${cantidadSesiones}`);
  } else {
    console.log(`Error de parseo: ${errorParseo}`);
  }
}

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error("Falta GEMINI_API_KEY en .env");
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  for (let i = 1; i <= 3; i++) {
    try {
      await unaCorrida(ai, i);
    } catch (e) {
      console.log(`\n--- CORRIDA ${i} FALLÓ ---`);
      console.log(e.message ?? e);
    }
  }
}

main().catch((e) => {
  console.error("Error fatal:", e);
  process.exit(1);
});
