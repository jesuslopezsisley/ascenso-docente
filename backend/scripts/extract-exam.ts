/**
 * Extrae y clasifica las 60 preguntas de un cuadernillo de examen (EBR
 * Primaria) a partir de sus PDFs en disco, y guarda el resultado en
 * docs/seed-preguntas-primaria-{anio}.json — MISMO formato que los años ya
 * sembrados (2018/2019/2021), sin sembrar nada en la base de datos.
 *
 * Uso:
 *   npx tsx scripts/extract-exam.ts <anio> <ruta-carpeta-cuadernillo>
 *
 * Ejemplo:
 *   npx tsx scripts/extract-exam.ts 2022 "D:\...\Concurso de Ascenso EB 2022\EBR Primaria - Forma 1"
 *
 * Espera la estructura de carpetas usada desde 2019 en adelante: 2
 * subcarpetas dentro de <ruta>, cada una con 1 PDF — una con el cuadernillo
 * de preguntas y otra con la hoja de respuestas separada. El nombre de la
 * subcarpeta de claves varía entre años ("Claves A04-EBRP-11" en 2019/2021/
 * 2022, "A04-EBRP-11 C" en 2023...), así que NO se identifica por nombre:
 * se detecta por contenido (el PDF que trae "Hoja de Respuestas" en su
 * primera página). 2018 no sigue esta estructura (respuestas embebidas en
 * un PDF combinado de varias secciones) y NO está soportado por este
 * script — para ese año se usó el proceso manual documentado en
 * docs/seed-preguntas-primaria-2018.json.
 *
 * El trabajo humano después de correr esto se reduce a revisar lo que el
 * script imprime al final: preguntas con discrepancia entre la clave oficial
 * y la lectura pedagógica independiente de Gemini, y preguntas candidatas a
 * tener contenido gráfico (imagen/mapa/tabla/gráfico) que conviene verificar
 * contra el PDF real antes de aprobar el archivo.
 */
import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { GoogleGenAI, Type } from '@google/genai';
import { COMPETENCIAS_PEDAGOGICAS } from '../src/diagnostico/constants/competencias';

const CANTIDAD_PREGUNTAS_ESPERADA = 60;
const ALTERNATIVAS = ['A', 'B', 'C'] as const;
type Alternativa = (typeof ALTERNATIVAS)[number];

// Palabras/frases que delatan que una pregunta depende de contenido no
// textual (imagen, mapa, gráfico, tabla, diagrama, afiche...) y por lo tanto
// conviene revisar visualmente contra el PDF real antes de aprobar.
const PISTAS_CONTENIDO_GRAFICO = [
  'según el gráfico',
  'según la gráfica',
  'según la imagen',
  'según el mapa',
  'según la tabla',
  'según el diagrama',
  'según el esquema',
  'observa la imagen',
  'observa el gráfico',
  'observa el mapa',
  'observa la tabla',
  'el siguiente mapa',
  'la siguiente imagen',
  'el siguiente gráfico',
  'la siguiente gráfica',
  'el siguiente diagrama',
  'el siguiente esquema',
  'la siguiente tabla',
  'el siguiente afiche',
  'la siguiente ilustración',
  'a partir de la imagen',
  'a partir del gráfico',
  'a partir del mapa',
  'a partir de la tabla',
  'recibe la imagen',
  'recibe el gráfico',
  'recibe el mapa',
  'presenta dicha imagen',
  'presenta dicho gráfico',
  'presenta dicho mapa',
  'presenta dicha tabla',
  'imagen',
  'gráfico',
  'gráfica',
  'mapa',
  'diagrama',
  'afiche',
  'ilustración',
  'esquema',
  'dibujo',
  'fotografía',
];

const NIVELES_CONFIANZA = ['alta', 'media', 'baja'] as const;
type NivelConfianza = (typeof NIVELES_CONFIANZA)[number];

interface PreguntaExtraida {
  numero: number;
  enunciado: string;
  alternativas: Record<Alternativa, string>;
  clave_correcta: Alternativa;
  escenario_docente_reacciona: boolean;
  razonamiento_competencia: string;
  competencia: (typeof COMPETENCIAS_PEDAGOGICAS)[number];
  confianza_competencia: NivelConfianza;
}

interface PreguntaSeed {
  enunciado: string;
  alternativas: Record<Alternativa, string>;
  respuestaCorrecta: Alternativa;
  competencia: string;
  fuente: string;
  anio: number;
}

function main() {
  const [anioArg, rutaArg] = process.argv.slice(2);
  if (!anioArg || !rutaArg) {
    console.error(
      'Uso: npx tsx scripts/extract-exam.ts <anio> <ruta-carpeta-cuadernillo>',
    );
    process.exit(1);
  }

  const anio = Number(anioArg);
  if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) {
    fallar(`El año "${anioArg}" no es válido.`);
  }

  const ruta = path.resolve(rutaArg);
  if (!fs.existsSync(ruta) || !fs.statSync(ruta).isDirectory()) {
    fallar(`La carpeta "${ruta}" no existe.`);
  }

  console.log(`\n=== Extrayendo cuadernillo ${anio} desde ${ruta} ===\n`);

  const { pdfPreguntas, pdfClaves } = localizarPdfs(ruta);
  console.log(`PDF de preguntas: ${pdfPreguntas}`);
  console.log(`PDF de claves:    ${pdfClaves}\n`);

  const textoPreguntasCrudo = extraerTextoPdf(pdfPreguntas);
  const textoClavesCrudo = extraerTextoPdf(pdfClaves);

  const bookletCode = detectarCodigoCuadernillo(textoPreguntasCrudo);
  console.log(`Código de cuadernillo detectado: ${bookletCode}`);

  const textoLimpio = limpiarTexto(textoPreguntasCrudo, bookletCode);
  const { textoAnotado, limites } = segmentarPreguntas(textoLimpio);

  validarSegmentacion(limites);
  console.log(
    `Segmentación: ${limites.length}/${CANTIDAD_PREGUNTAS_ESPERADA} preguntas detectadas por numeración.\n`,
  );

  const clavesOficiales = parsearClaves(textoClavesCrudo);
  validarClaves(clavesOficiales);
  console.log(
    `Hoja de claves: ${clavesOficiales.size}/${CANTIDAD_PREGUNTAS_ESPERADA} respuestas leídas.\n`,
  );

  console.log('Llamando a Gemini (una sola vez, para las 60 preguntas)...\n');
  extraerConGemini(textoAnotado, anio)
    .then((preguntas) => {
      validarRespuestaGemini(preguntas);

      const discrepancias: {
        numero: number;
        geminiDijo: Alternativa;
        claveOficial: Alternativa;
      }[] = [];
      const graficas: { numero: number; pista: string }[] = [];
      const revisiones: {
        numero: number;
        motivo: string;
        razonamiento: string;
      }[] = [];

      const seed: PreguntaSeed[] = preguntas
        .sort((a, b) => a.numero - b.numero)
        .map((p) => {
          const claveOficial = clavesOficiales.get(p.numero);
          if (!claveOficial) {
            fallar(`No hay clave oficial para la pregunta ${p.numero}.`);
          }
          if (claveOficial !== p.clave_correcta) {
            discrepancias.push({
              numero: p.numero,
              geminiDijo: p.clave_correcta,
              claveOficial,
            });
          }

          const pista = detectarPistaGrafica(p);
          if (pista) {
            graficas.push({ numero: p.numero, pista });
          }

          // Bandera de confianza permanente (independiente del modelo
          // usado): confianza baja, o el patrón de confusión conocido
          // (docente reaccionando a un estudiante) sin importar qué tan
          // bueno sea el modelo hoy.
          const motivosRevision: string[] = [];
          if (p.confianza_competencia === 'baja') {
            motivosRevision.push('confianza baja');
          }
          if (p.escenario_docente_reacciona) {
            motivosRevision.push('escenario docente-reacciona-a-estudiante');
          }
          if (motivosRevision.length > 0) {
            revisiones.push({
              numero: p.numero,
              motivo: motivosRevision.join(' + '),
              razonamiento: p.razonamiento_competencia,
            });
          }

          return {
            enunciado: p.enunciado,
            alternativas: p.alternativas,
            respuestaCorrecta: claveOficial,
            competencia: p.competencia,
            fuente: `${bookletCode}-${anio}`,
            anio,
          };
        });

      const outPath = path.join(
        __dirname,
        '..',
        '..',
        'docs',
        `seed-preguntas-primaria-${anio}.json`,
      );
      fs.writeFileSync(outPath, JSON.stringify(seed, null, 2) + '\n', 'utf-8');

      imprimirResumen(seed, discrepancias, graficas, revisiones, outPath);
    })
    .catch((error: unknown) => {
      console.error('\nError llamando a Gemini o procesando su respuesta:');
      console.error(error);
      process.exit(1);
    });
}

function fallar(mensaje: string): never {
  console.error(`\nERROR: ${mensaje}\n`);
  process.exit(1);
}

/**
 * Busca el PDF de preguntas y el de claves dentro de `ruta`. El nombre de la
 * subcarpeta de claves varía entre años ("Claves A04-EBRP-11" en 2019/2021/
 * 2022, "A04-EBRP-11 C" en 2023...), así que NO se distingue por nombre de
 * carpeta sino por CONTENIDO: el PDF que trae "Hoja de Respuestas" en su
 * primera página es la clave; el otro es el cuadernillo de preguntas. Este
 * script solo soporta la estructura de 2 subcarpetas con 1 PDF cada una,
 * usada desde 2019 en adelante — 2018 (respuestas embebidas en un PDF
 * combinado de varias secciones) no está soportado, usa el proceso manual.
 */
function localizarPdfs(ruta: string): {
  pdfPreguntas: string;
  pdfClaves: string;
} {
  const entradas = fs
    .readdirSync(ruta, { withFileTypes: true })
    .filter((e) => e.isDirectory());

  const pdfsPorCarpeta = entradas.map((e) => ({
    carpeta: e.name,
    pdf: unicoPdfEn(path.join(ruta, e.name)),
  }));

  if (pdfsPorCarpeta.length !== 2) {
    fallar(
      `Se esperaban exactamente 2 subcarpetas con 1 PDF cada una (preguntas + claves) dentro de "${ruta}", ` +
        `se encontraron ${pdfsPorCarpeta.length}: ${pdfsPorCarpeta.map((p) => p.carpeta).join(', ') || '(ninguna)'}. ` +
        `Si es un cuadernillo estilo 2018 (respuestas embebidas en un PDF combinado), usa el proceso manual.`,
    );
  }

  const clasificadas = pdfsPorCarpeta.map((p) => ({
    ...p,
    esClaves: esPdfDeClaves(p.pdf),
  }));
  const claves = clasificadas.filter((c) => c.esClaves);
  const preguntas = clasificadas.filter((c) => !c.esClaves);

  if (claves.length !== 1 || preguntas.length !== 1) {
    fallar(
      `No se pudo distinguir cuál PDF es la hoja de claves y cuál el cuadernillo de preguntas dentro de "${ruta}" ` +
        `(se esperaba que exactamente 1 de los 2 trajera "Hoja de Respuestas" en su primera página). ` +
        `Carpetas: ${pdfsPorCarpeta.map((p) => p.carpeta).join(', ')}.`,
    );
  }

  return { pdfPreguntas: preguntas[0].pdf, pdfClaves: claves[0].pdf };
}

function esPdfDeClaves(pdfPath: string): boolean {
  const primeraPagina = execFileSync(
    'pdftotext',
    ['-layout', '-enc', 'UTF-8', '-f', '1', '-l', '1', pdfPath, '-'],
    { encoding: 'utf-8', maxBuffer: 5 * 1024 * 1024 },
  );
  return /hoja de respuestas/i.test(primeraPagina);
}

function unicoPdfEn(carpeta: string): string {
  const pdfs = fs
    .readdirSync(carpeta)
    .filter((f) => f.toLowerCase().endsWith('.pdf'));
  if (pdfs.length !== 1) {
    fallar(
      `Se esperaba exactamente 1 PDF en "${carpeta}", se encontraron ${pdfs.length}.`,
    );
  }
  return path.join(carpeta, pdfs[0]);
}

function extraerTextoPdf(pdfPath: string): string {
  return execFileSync('pdftotext', ['-layout', '-enc', 'UTF-8', pdfPath, '-'], {
    encoding: 'utf-8',
    maxBuffer: 50 * 1024 * 1024,
  });
}

/** El código de cuadernillo (p. ej. "A04-EBRP-11") aparece decenas de veces
 * como encabezado/pie de página; se toma el patrón más frecuente. */
export function detectarCodigoCuadernillo(texto: string): string {
  const matches = texto.match(/\b[A-Z]\d{2}-[A-Z]{2,10}-\d{2}\b/g) ?? [];
  if (matches.length === 0) {
    fallar(
      'No se pudo detectar el código de cuadernillo (patrón tipo A04-EBRP-11) en el PDF de preguntas.',
    );
  }
  const conteo = new Map<string, number>();
  for (const m of matches) conteo.set(m, (conteo.get(m) ?? 0) + 1);
  return [...conteo.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/** Quita el ruido de pdftotext -layout: el código A21_04_NN pegado en medio
 * del texto (artefacto de posición de pie de página) y las líneas de
 * pie/encabezado de página (número de página + código de cuadernillo). */
export function limpiarTexto(texto: string, bookletCode: string): string {
  // Sin \b al final: el marcador suele venir pegado sin separador al número
  // real de la siguiente pregunta (p. ej. "A21_04_02" + "2 Durante..." con
  // cero espacio entre ambos), así que exigir un límite de palabra ahí
  // impedía que coincidiera.
  let limpio = texto.replace(/\b[A-Z]\d{2}_\d{2}_\d{2}/g, '');
  const codigoEscapado = bookletCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const lineasFooter = new RegExp(
    `^\\s*(?:\\d+\\s+${codigoEscapado}|${codigoEscapado}\\s+\\d+|${codigoEscapado})\\s*$`,
  );
  limpio = limpio
    .split('\n')
    .filter((linea) => !lineasFooter.test(linea))
    .join('\n');
  return limpio;
}

interface LimiteSegmento {
  numero: number;
  lineIndex: number;
}

/**
 * Segmenta por patrón de numeración: una línea que empieza EXACTAMENTE con
 * el siguiente número esperado (1, 2, 3, ... 60), validada con lookahead —
 * solo se acepta si más adelante (antes del siguiente número esperado)
 * aparecen líneas "a ...", "b ..." y "c ..." en ese orden, que es la firma
 * estructural de una pregunta real (evita falsos positivos con números
 * mencionados dentro del contenido, p. ej. cantidades en un problema
 * matemático).
 */
export function segmentarPreguntas(texto: string): {
  textoAnotado: string;
  limites: LimiteSegmento[];
} {
  const lineas = texto.split('\n');
  const limites: LimiteSegmento[] = [];
  let siguienteEsperado = 1;

  for (
    let i = 0;
    i < lineas.length && siguienteEsperado <= CANTIDAD_PREGUNTAS_ESPERADA;
    i++
  ) {
    const linea = lineas[i].trimStart();
    // Normalmente el número está al inicio de la línea, pero a veces queda
    // pegado sin espacio al final de texto de un gráfico/tabla incrustado
    // en esa misma posición de la página (p. ej. una etiqueta de eje como
    // "Cantidad de estudiantes57 El equipo..."). Por eso se busca el número
    // en cualquier posición de la línea (mientras no sea parte de un número
    // más largo), y se confía en tieneFirmaDeAlternativas() como red de
    // seguridad contra falsos positivos.
    const candidatos = [...linea.matchAll(/(?:^|\D)(\d{1,2})(?:[\s.)]|$)/g)];
    const candidato = candidatos.find(
      (m) => Number(m[1]) === siguienteEsperado,
    );
    if (!candidato) continue;

    if (tieneFirmaDeAlternativas(lineas, i, siguienteEsperado)) {
      limites.push({ numero: siguienteEsperado, lineIndex: i });
      siguienteEsperado++;
    }
  }

  const lineasAnotadas = [...lineas];
  // Insertar en orden descendente para no invalidar los índices ya calculados.
  for (const limite of [...limites].sort((a, b) => b.lineIndex - a.lineIndex)) {
    lineasAnotadas.splice(
      limite.lineIndex,
      0,
      `\n=== PREGUNTA ${limite.numero} ===`,
    );
  }

  return { textoAnotado: lineasAnotadas.join('\n'), limites };
}

function tieneFirmaDeAlternativas(
  lineas: string[],
  desde: number,
  numeroActual: number,
): boolean {
  const siguienteNumero = new RegExp(`^\\s*${numeroActual + 1}(?:[\\s.)]|$)`);
  let vistoA = false;
  let vistoB = false;
  const LIMITE_LINEAS = 60;

  for (
    let i = desde + 1;
    i < Math.min(lineas.length, desde + 1 + LIMITE_LINEAS);
    i++
  ) {
    const linea = lineas[i].trimStart();
    if (siguienteNumero.test(linea)) return false;
    if (!vistoA && /^a[\s)]/.test(linea)) {
      vistoA = true;
    } else if (vistoA && !vistoB && /^b[\s)]/.test(linea)) {
      vistoB = true;
    } else if (vistoA && vistoB && /^c[\s)]/.test(linea)) {
      return true;
    }
  }
  return false;
}

function validarSegmentacion(limites: LimiteSegmento[]): void {
  if (limites.length === CANTIDAD_PREGUNTAS_ESPERADA) return;

  const encontrados = new Set(limites.map((l) => l.numero));
  const faltantes = Array.from(
    { length: CANTIDAD_PREGUNTAS_ESPERADA },
    (_, i) => i + 1,
  ).filter((n) => !encontrados.has(n));
  fallar(
    `La segmentación por numeración encontró ${limites.length}/${CANTIDAD_PREGUNTAS_ESPERADA} preguntas, no 60. ` +
      `Números faltantes: ${faltantes.join(', ')}. ` +
      `Revisa el texto extraído (puede que el layout de este cuadernillo requiera ajustar el patrón de segmentación).`,
  );
}

/** Tabla "Hoja de Respuestas": filas "N LETRA" o pares "N LETRA N LETRA". */
export function parsearClaves(texto: string): Map<number, Alternativa> {
  const claves = new Map<number, Alternativa>();
  const filaDoble = /(\d{1,2})\s+([ABC])\s+(\d{1,2})\s+([ABC])/g;
  const filaSimple = /^\s*(\d{1,2})\s+([ABC])\s*$/gm;

  let match: RegExpExecArray | null;
  while ((match = filaDoble.exec(texto)) !== null) {
    claves.set(Number(match[1]), match[2] as Alternativa);
    claves.set(Number(match[3]), match[4] as Alternativa);
  }
  if (claves.size < CANTIDAD_PREGUNTAS_ESPERADA) {
    while ((match = filaSimple.exec(texto)) !== null) {
      claves.set(Number(match[1]), match[2] as Alternativa);
    }
  }
  return claves;
}

function validarClaves(claves: Map<number, Alternativa>): void {
  const faltantes = Array.from(
    { length: CANTIDAD_PREGUNTAS_ESPERADA },
    (_, i) => i + 1,
  ).filter((n) => !claves.has(n));
  if (faltantes.length > 0) {
    fallar(
      `La hoja de claves no tiene las 60 respuestas esperadas. Faltantes: ${faltantes.join(', ')}.`,
    );
  }
}

const PREGUNTA_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    numero: { type: Type.INTEGER },
    enunciado: { type: Type.STRING },
    alternativas: {
      type: Type.OBJECT,
      properties: {
        A: { type: Type.STRING },
        B: { type: Type.STRING },
        C: { type: Type.STRING },
      },
      required: ['A', 'B', 'C'],
    },
    clave_correcta: { type: Type.STRING, enum: [...ALTERNATIVAS] },
    // Los siguientes 4 campos van DESPUÉS de clave_correcta pero ANTES de
    // competencia a propósito: como la salida estructurada se genera en
    // orden, esto obliga a que el modelo "piense en voz alta" sobre el
    // patrón de confusión conocido y razone brevemente ANTES de comprometerse
    // con la competencia final — no son solo metadata post-hoc.
    escenario_docente_reacciona: {
      type: Type.BOOLEAN,
      description:
        'true si el escenario de la pregunta involucra a un docente evaluando, respondiendo, corrigiendo, orientando o ayudando a un estudiante EN RELACIÓN A algo que el estudiante YA dijo, hizo o produjo — esto incluye tanto reacciones espontáneas del docente COMO casos donde el estudiante pide ayuda para mejorar/corregir su propio trabajo. FALSE si es una estrategia didáctica general para introducir/enseñar un concepto nuevo desde cero, sin un trabajo/respuesta/error previo de un estudiante específico (ahí no hay nada que retroalimentar). El requisito clave es que exista una producción PREVIA del estudiante siendo atendida, no que el docente simplemente "ayude" o "enseñe". Independientemente de cuál sea la competencia correcta — este patrón se confunde frecuentemente con retroalimentacion_acompanamiento aunque el contenido de fondo sea otra competencia.',
    },
    razonamiento_competencia: {
      type: Type.STRING,
      description:
        'Explica en 1-2 oraciones por qué elegiste esa competencia y no otra, especialmente si escenario_docente_reacciona es true.',
    },
    competencia: { type: Type.STRING, enum: [...COMPETENCIAS_PEDAGOGICAS] },
    confianza_competencia: {
      type: Type.STRING,
      enum: [...NIVELES_CONFIANZA],
      description:
        'Qué tan seguro estás de la clasificación de competencia (no de la clave_correcta). "baja" si dudaste entre 2 competencias o el enunciado es ambiguo.',
    },
  },
  required: [
    'numero',
    'enunciado',
    'alternativas',
    'clave_correcta',
    'escenario_docente_reacciona',
    'razonamiento_competencia',
    'competencia',
    'confianza_competencia',
  ],
};

/**
 * Lee las preguntas ya clasificadas y aprobadas de otros años
 * (docs/seed-preguntas-primaria-*.json, excluyendo el año que se está
 * procesando ahora) y arma ejemplos por competencia, para calibrar a Gemini
 * con el mismo criterio ya usado — sin esto, la clasificación de un LLM
 * "en frío" diverge bastante del criterio establecido entre años.
 */
function construirEjemplosCalibracion(anioActual: number): string {
  const docsDir = path.join(__dirname, '..', '..', 'docs');
  const archivos = fs
    .readdirSync(docsDir)
    .filter((f) => /^seed-preguntas-primaria-\d{4}\.json$/.test(f))
    .filter((f) => !f.includes(String(anioActual)));

  if (archivos.length === 0) return '';

  const ejemplosPorCompetencia = new Map<string, string[]>();
  for (const archivo of archivos) {
    const preguntas = JSON.parse(
      fs.readFileSync(path.join(docsDir, archivo), 'utf-8'),
    ) as PreguntaSeed[];
    for (const p of preguntas) {
      const lista = ejemplosPorCompetencia.get(p.competencia) ?? [];
      if (lista.length < 4) {
        lista.push(p.enunciado.replace(/\s+/g, ' ').slice(0, 240));
        ejemplosPorCompetencia.set(p.competencia, lista);
      }
    }
  }

  const bloques = COMPETENCIAS_PEDAGOGICAS.map((competencia) => {
    const ejemplos = ejemplosPorCompetencia.get(competencia) ?? [];
    if (ejemplos.length === 0)
      return `${competencia}: (sin ejemplos disponibles)`;
    return `${competencia}:\n${ejemplos.map((e) => `  - "${e}..."`).join('\n')}`;
  });

  return `\nEjemplos de preguntas YA clasificadas en años anteriores (usa el MISMO
criterio para mantener consistencia entre años — mantener este criterio
estable es más importante que tu propia intuición sobre dónde "debería" ir
una pregunta ambigua):\n\n${bloques.join('\n\n')}\n`;
}

export async function extraerConGemini(
  textoAnotado: string,
  anio: number,
): Promise<PreguntaExtraida[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    fallar('GEMINI_API_KEY no está configurado en backend/.env.');
  }
  const model = process.env.GEMINI_MODEL_EXTRACT ?? 'gemini-3.6-flash';
  const ai = new GoogleGenAI({ apiKey });
  const ejemplosCalibracion = construirEjemplosCalibracion(anio);

  const prompt = `Eres un asistente que transcribe y clasifica preguntas de examen de un
cuadernillo del "Concurso de Ascenso de Escala Magisterial" del Perú, nivel
EBR Primaria. A continuación se te da el texto completo del cuadernillo
(extraído de un PDF con pdftotext -layout), con marcadores "=== PREGUNTA N ==="
insertados justo antes de donde empieza cada una de las 60 preguntas.

Para CADA UNA de las 60 preguntas marcadas, produce un objeto con:
- numero: el número de pregunta (el mismo del marcador "=== PREGUNTA N ===").
- enunciado: el enunciado completo de la pregunta, limpio de saltos de línea
  y espacios extra de la extracción. IMPORTANTE: si la pregunta depende de un
  texto, situación o imagen compartida con otras preguntas cercanas (p. ej.
  "Lea la siguiente situación y responda las preguntas 1, 2, 3 y 4"), copia
  ese contexto compartido DENTRO del enunciado de CADA una de esas preguntas
  (no lo omitas asumiendo que "ya se dijo antes" — cada pregunta debe ser
  autocontenida).
- alternativas: objeto {A, B, C} con el texto de cada alternativa, limpio.
- clave_correcta: la letra (A, B o C) que TÚ consideras la respuesta
  pedagógicamente correcta, razonando el contenido de la pregunta. NO
  busques ni asumas una clave oficial en el texto — es tu propio juicio
  independiente, se usará como control de calidad cruzándolo después contra
  la clave oficial real.
- escenario_docente_reacciona: true/false — ¿el escenario de la pregunta
  involucra a un docente evaluando, respondiendo, corrigiendo, orientando o
  ayudando a un estudiante EN RELACIÓN A algo que el estudiante YA DIJO,
  HIZO O PRODUJO? Esto incluye TANTO reacciones espontáneas del docente
  COMO casos donde es el estudiante quien pide ayuda para mejorar o
  corregir su propio trabajo (p. ej. "el estudiante le pide que lo ayude a
  mejorar su texto" — eso también cuenta, no solo cuando el docente
  interviene sin que se lo pidan).

  IMPORTANTE — esto es false, NO true, cuando la pregunta es sobre una
  ESTRATEGIA DIDÁCTICA GENERAL para introducir o enseñar un concepto NUEVO
  desde cero, sin que exista una producción, respuesta o error previo de
  un estudiante específico que el docente esté evaluando o corrigiendo
  (p. ej. "¿cuál de las siguientes acciones es pertinente para que los
  estudiantes se inicien en la construcción de la noción de doble?" → esto
  es false: no hay nada previo del estudiante que retroalimentar, es
  enseñanza de un concepto nuevo). El requisito clave es que exista un
  trabajo/respuesta/error PREVIO del estudiante siendo atendido — no basta
  con que el docente "ayude" o "enseñe" de alguna forma.

  Responde esto ANTES de decidir la competencia, con la cabeza fría: que
  el escenario tenga esta forma NO significa automáticamente que la
  competencia sea retroalimentacion_acompanamiento.
- razonamiento_competencia: 1-2 oraciones explicando por qué elegiste esa
  competencia. Si escenario_docente_reacciona es true, tu razonamiento debe
  decidir explícitamente entre estas dos posibilidades: (a) lo que la
  pregunta evalúa es el DOMINIO DE CONTENIDO de fondo (¿el estudiante debe
  razonar sobre matemática? ¿sobre una indagación científica? ¿sobre un
  texto?) → usa esa competencia de contenido, NO
  retroalimentacion_acompanamiento; o (b) lo que la pregunta evalúa ES la
  técnica pedagógica de retroalimentación/acompañamiento en sí misma (p. ej.
  "¿cuál de estas respuestas del docente ayuda mejor al estudiante a
  identificar y corregir su propio error?", donde la respuesta correcta
  depende de LA FORMA de la intervención docente, no del contenido) → ahí sí
  usa retroalimentacion_acompanamiento.

  Pista adicional para decidir entre (a) y (b), aplicable SOLO cuando
  escenario_docente_reacciona es true (es decir, solo cuando ya hay un
  trabajo/respuesta/error previo del estudiante siendo atendido — NUNCA
  para preguntas de estrategia didáctica general o introducción de un
  concepto nuevo desde cero, esas van directo a la competencia de
  contenido sin pasar por esta pista). Fíjate en qué comparan las
  alternativas entre sí:

  - Si las alternativas SON distintos posibles DIAGNÓSTICOS — cada una
    identifica un problema/error DIFERENTE que podría estar presente, y
    hay que reconocer cuál de esos problemas es el que realmente se
    evidencia (p. ej. "¿la docente debe priorizar A: desvío del
    propósito, B: falta de concordancia, o C: léxico inadecuado?", donde
    A/B/C son diagnósticos distintos, no formas distintas de abordar el
    MISMO diagnóstico) → esto es conocimiento de contenido: usa la
    competencia de contenido correspondiente, NO
    retroalimentacion_acompanamiento.

  - Si el enunciado YA nombra explícitamente CUÁL es el error/problema
    específico del estudiante, y las alternativas son distintas
    TÉCNICAS/ESTRATEGIAS para abordar ESE MISMO error ya identificado →
    esto SÍ es retroalimentacion_acompanamiento, SIN IMPORTAR qué tan
    específica del dominio sea la técnica descrita (p. ej. usar un
    tablero de valor posicional, comparar con tarjetas léxicas, señalar
    el sonido de una letra — que la técnica use herramientas propias de
    matemática o de lectoescritura NO la convierte en competencia de
    contenido; la especificidad de la técnica es señal de que es una
    BUENA retroalimentación, no evidencia de que sea otra competencia).

  Es una pista de juicio, no una regla rígida — no es determinante por sí
  sola, sopésala junto con el resto del enunciado.
- competencia: exactamente UNA de estas 8 competencias pedagógicas (usa el
  string exacto, en snake_case), consistente con razonamiento_competencia:
  ${COMPETENCIAS_PEDAGOGICAS.map((c) => `- ${c}`).join('\n  ')}
- confianza_competencia: "alta", "media" o "baja" — qué tan seguro estás de
  la competencia elegida. Usa "baja" con honestidad cuando dudaste entre 2
  competencias o el enunciado es genuinamente ambiguo; no infles la
  confianza.
${ejemplosCalibracion}
Responde con un array JSON de exactamente 60 objetos, uno por pregunta, sin
texto adicional fuera del JSON.

--- TEXTO DEL CUADERNILLO ---
${textoAnotado}`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: { type: Type.ARRAY, items: PREGUNTA_SCHEMA },
      maxOutputTokens: 65536,
    },
  });

  const texto = response.text;
  if (!texto) {
    fallar('Gemini no devolvió contenido.');
  }
  try {
    return JSON.parse(texto) as PreguntaExtraida[];
  } catch (error) {
    const finishReason = response.candidates?.[0]?.finishReason;
    const debugPath = path.join(__dirname, '..', 'gemini-response-debug.txt');
    fs.writeFileSync(debugPath, texto, 'utf-8');
    console.error(
      `finishReason: ${finishReason}, largo: ${texto.length} caracteres`,
    );
    console.error(`Respuesta cruda guardada en: ${debugPath}`);
    console.error(error);
    fallar(
      'La respuesta de Gemini no es JSON válido a pesar del responseSchema.',
    );
  }
}

function validarRespuestaGemini(preguntas: PreguntaExtraida[]): void {
  if (
    !Array.isArray(preguntas) ||
    preguntas.length !== CANTIDAD_PREGUNTAS_ESPERADA
  ) {
    fallar(
      `Gemini devolvió ${Array.isArray(preguntas) ? preguntas.length : 'algo que no es un array'} preguntas, no 60.`,
    );
  }
  const numeros = new Set(preguntas.map((p) => p.numero));
  const faltantes = Array.from(
    { length: CANTIDAD_PREGUNTAS_ESPERADA },
    (_, i) => i + 1,
  ).filter((n) => !numeros.has(n));
  if (faltantes.length > 0) {
    fallar(`Gemini no devolvió las preguntas: ${faltantes.join(', ')}.`);
  }
  for (const p of preguntas) {
    if (!COMPETENCIAS_PEDAGOGICAS.includes(p.competencia)) {
      fallar(
        `Pregunta ${p.numero}: competencia desconocida "${p.competencia}".`,
      );
    }
    if (!ALTERNATIVAS.includes(p.clave_correcta)) {
      fallar(
        `Pregunta ${p.numero}: clave_correcta inválida "${p.clave_correcta}".`,
      );
    }
    if (!p.alternativas?.A || !p.alternativas?.B || !p.alternativas?.C) {
      fallar(`Pregunta ${p.numero}: faltan alternativas.`);
    }
    if (!NIVELES_CONFIANZA.includes(p.confianza_competencia)) {
      fallar(
        `Pregunta ${p.numero}: confianza_competencia inválida "${p.confianza_competencia}".`,
      );
    }
    if (typeof p.escenario_docente_reacciona !== 'boolean') {
      fallar(
        `Pregunta ${p.numero}: escenario_docente_reacciona no es booleano.`,
      );
    }
    if (!p.razonamiento_competencia) {
      fallar(`Pregunta ${p.numero}: falta razonamiento_competencia.`);
    }
  }
}

function detectarPistaGrafica(p: PreguntaExtraida): string | null {
  const texto = [
    p.enunciado,
    p.alternativas.A,
    p.alternativas.B,
    p.alternativas.C,
  ]
    .join(' ')
    .toLowerCase();
  for (const pista of PISTAS_CONTENIDO_GRAFICO) {
    if (texto.includes(pista)) return pista;
  }
  return null;
}

function imprimirResumen(
  seed: PreguntaSeed[],
  discrepancias: {
    numero: number;
    geminiDijo: Alternativa;
    claveOficial: Alternativa;
  }[],
  graficas: { numero: number; pista: string }[],
  revisiones: { numero: number; motivo: string; razonamiento: string }[],
  outPath: string,
): void {
  const conteoPorCompetencia = new Map<string, number>();
  for (const p of seed) {
    conteoPorCompetencia.set(
      p.competencia,
      (conteoPorCompetencia.get(p.competencia) ?? 0) + 1,
    );
  }

  console.log(`\n=== Guardado: ${outPath} (${seed.length} preguntas) ===\n`);
  console.log('Resumen por competencia:');
  for (const [competencia, cantidad] of [
    ...conteoPorCompetencia.entries(),
  ].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${competencia}: ${cantidad}`);
  }

  console.log(
    `\nDiscrepancias clave oficial vs. lectura independiente de Gemini (${discrepancias.length}):`,
  );
  if (discrepancias.length === 0) {
    console.log('  Ninguna.');
  } else {
    for (const d of discrepancias) {
      console.log(
        `  Pregunta ${d.numero}: Gemini dijo ${d.geminiDijo}, clave oficial dice ${d.claveOficial} — REVISAR.`,
      );
    }
  }

  console.log(
    `\nPreguntas candidatas a tener contenido gráfico (${graficas.length}):`,
  );
  if (graficas.length === 0) {
    console.log('  Ninguna.');
  } else {
    for (const g of graficas) {
      console.log(
        `  Pregunta ${g.numero}: pista "${g.pista}" — verificar visualmente contra el PDF.`,
      );
    }
  }

  console.log(
    `\nPreguntas a revisar por confianza baja o patrón docente-reacciona (${revisiones.length}):`,
  );
  if (revisiones.length === 0) {
    console.log('  Ninguna.');
  } else {
    for (const r of revisiones) {
      console.log(`  Pregunta ${r.numero} [${r.motivo}]: ${r.razonamiento}`);
    }
  }
  console.log('');
}

if (require.main === module) {
  main();
}
