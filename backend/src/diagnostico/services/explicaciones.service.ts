import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeminiService } from '../../ia/services/gemini.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Genera, con IA, la explicación de cada pregunta fallada de un diagnóstico
 * y la persiste en Respuesta.explicacion. Mismo patrón que
 * DiagnosticoService.generarPlanEstudio: un solo prompt en batch, parseo +
 * validación de la respuesta, persistencia en transacción.
 *
 * Modo mock (GEMINI_MOCK_EXPLICACIONES=true): en vez de llamar a Gemini,
 * arma un texto de relleno plausible a partir del enunciado y las
 * alternativas — sirve para probar el flujo completo de guardado y
 * visualización sin gastar cuota ni depender de la API real.
 */
@Injectable()
export class ExplicacionesService {
  private readonly logger = new Logger(ExplicacionesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiService,
    private readonly config: ConfigService,
  ) {}

  private get mockActivo(): boolean {
    return this.config.get<string>('GEMINI_MOCK_EXPLICACIONES') === 'true';
  }

  /**
   * Best-effort: si la generación falla, se loguea y no se propaga. El
   * diagnóstico ya está finalizado; las explicaciones quedan en null y la
   * pantalla de revisión lo maneja. Solo procesa respuestas incorrectas que
   * todavía no tienen explicación, así que es seguro reintentarlo.
   */
  async generarParaDiagnostico(diagnosticoId: string): Promise<void> {
    const falladas = await this.prisma.respuesta.findMany({
      where: { diagnosticoId, esCorrecta: false, explicacion: null },
      select: {
        id: true,
        alternativaElegida: true,
        pregunta: {
          select: {
            id: true,
            enunciado: true,
            alternativas: true,
            respuestaCorrecta: true,
          },
        },
      },
    });
    if (falladas.length === 0) return;

    const items: ItemFallada[] = falladas.map((r) => ({
      respuestaId: r.id,
      preguntaId: r.pregunta.id,
      enunciado: r.pregunta.enunciado,
      alternativas: this.normalizarAlternativas(r.pregunta.alternativas),
      elegida: r.alternativaElegida,
      correcta: r.pregunta.respuestaCorrecta,
    }));

    let generadas: ExplicacionGenerada[];
    try {
      generadas = this.mockActivo
        ? items.map((it) => this.explicacionMock(it))
        : await this.generarConGemini(items);
    } catch (error) {
      this.logger.error(
        `No se pudieron generar explicaciones para el diagnóstico ${diagnosticoId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return;
    }

    const porPreguntaId = new Map(generadas.map((e) => [e.preguntaId, e]));
    const updates = items
      .filter((it) => porPreguntaId.has(it.preguntaId))
      .map((it) => {
        const e = porPreguntaId.get(it.preguntaId)!;
        return this.prisma.respuesta.update({
          where: { id: it.respuestaId },
          data: {
            explicacion: `${e.porQueEstaMal.trim()} ${e.porQueLaCorrectaEsMejor.trim()}`,
          },
        });
      });

    if (updates.length === 0) {
      this.logger.warn(
        `La generación de explicaciones para ${diagnosticoId} no devolvió ninguna coincidencia por preguntaId`,
      );
      return;
    }

    await this.prisma.$transaction(updates);
  }

  private normalizarAlternativas(valor: unknown): Record<string, string> {
    if (typeof valor === 'object' && valor !== null) {
      return valor as Record<string, string>;
    }
    return {};
  }

  // ---------------------------------------------------------------------------
  // Mock
  // ---------------------------------------------------------------------------

  private explicacionMock(it: ItemFallada): ExplicacionGenerada {
    const textoElegida = this.recortar(
      it.alternativas[it.elegida] ?? `la alternativa ${it.elegida}`,
    );
    const textoCorrecta = this.recortar(
      it.alternativas[it.correcta] ?? `la alternativa ${it.correcta}`,
    );
    const foco = this.focoEnunciado(it.enunciado);

    return {
      preguntaId: it.preguntaId,
      porQueEstaMal:
        `Marcaste "${textoElegida}", pero esa opción no responde a ${foco}: ` +
        `se queda en un detalle secundario y deja de lado lo que la pregunta realmente pide.`,
      porQueLaCorrectaEsMejor:
        `La respuesta correcta era "${textoCorrecta}", porque sí aborda directamente ` +
        `${foco} y es la que mejor se sostiene con lo que plantea el enunciado.`,
    };
  }

  /** Toma el enunciado y arma una frase corta tipo "la situación sobre ...". */
  private focoEnunciado(enunciado: string): string {
    const limpio = enunciado.replace(/\s+/g, ' ').trim().replace(/[.:]$/, '');
    const palabras = limpio.split(' ');
    const extracto =
      palabras.length > 14 ? palabras.slice(0, 14).join(' ') + '…' : limpio;
    return `lo que plantea "${extracto}"`;
  }

  private recortar(texto: string, max = 90): string {
    const limpio = texto.replace(/\s+/g, ' ').trim();
    return limpio.length > max
      ? limpio.slice(0, max - 1).trimEnd() + '…'
      : limpio;
  }

  // ---------------------------------------------------------------------------
  // Gemini real
  // ---------------------------------------------------------------------------

  private async generarConGemini(
    items: ItemFallada[],
  ): Promise<ExplicacionGenerada[]> {
    const prompt = this.construirPrompt(items);
    const textoCrudo = await this.gemini.generarTexto(prompt);
    return this.parsear(textoCrudo, items);
  }

  private construirPrompt(items: ItemFallada[]): string {
    const preguntas = items.map((it) => ({
      preguntaId: it.preguntaId,
      enunciado: it.enunciado,
      alternativas: it.alternativas,
      alternativaElegida: it.elegida,
      alternativaCorrecta: it.correcta,
    }));

    return `Eres un asesor pedagógico que acompaña a docentes peruanos de EBR Primaria
que se preparan para el examen de ascenso de escala magisterial.

El docente rindió un diagnóstico y falló las siguientes preguntas de opción múltiple
(alternativas A, B y C). Para CADA pregunta, explica en lenguaje claro y cotidiano,
SIN tecnicismos, pensando en que el docente lo entienda apenas lo lea:

- "porQueEstaMal": 1 o 2 oraciones sobre por qué la alternativa que eligió no es adecuada.
- "porQueLaCorrectaEsMejor": 1 o 2 oraciones sobre por qué la alternativa correcta sí lo es.

No repitas el enunciado ni digas "la alternativa A/B/C"; explica el porqué del contenido.

Preguntas falladas:
${JSON.stringify(preguntas, null, 2)}

Responde ÚNICAMENTE con un JSON válido, sin texto adicional ni markdown, con esta forma exacta
(un objeto por pregunta, en el mismo orden, conservando el preguntaId):
[
  {
    "preguntaId": "string",
    "porQueEstaMal": "string, 1-2 oraciones",
    "porQueLaCorrectaEsMejor": "string, 1-2 oraciones"
  }
]`;
  }

  private parsear(
    textoCrudo: string,
    items: ItemFallada[],
  ): ExplicacionGenerada[] {
    let limpio = textoCrudo.trim();
    const fence = limpio.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
    if (fence) {
      limpio = fence[1].trim();
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(limpio);
    } catch {
      throw new ServiceUnavailableException(
        'Gemini devolvió una respuesta que no se pudo interpretar como JSON',
      );
    }

    if (!Array.isArray(parsed) || !parsed.every((e) => this.esValida(e))) {
      throw new ServiceUnavailableException(
        'Gemini devolvió explicaciones con un formato inesperado',
      );
    }

    const idsEsperados = new Set(items.map((it) => it.preguntaId));
    const filtradas = parsed.filter((e) => idsEsperados.has(e.preguntaId));
    if (filtradas.length === 0) {
      throw new ServiceUnavailableException(
        'Gemini no devolvió explicaciones para ninguna de las preguntas enviadas',
      );
    }
    return filtradas;
  }

  private esValida(valor: unknown): valor is ExplicacionGenerada {
    if (typeof valor !== 'object' || valor === null) return false;
    const v = valor as Record<string, unknown>;
    return (
      typeof v.preguntaId === 'string' &&
      typeof v.porQueEstaMal === 'string' &&
      v.porQueEstaMal.trim().length > 0 &&
      typeof v.porQueLaCorrectaEsMejor === 'string' &&
      v.porQueLaCorrectaEsMejor.trim().length > 0
    );
  }
}

interface ItemFallada {
  respuestaId: string;
  preguntaId: string;
  enunciado: string;
  alternativas: Record<string, string>;
  elegida: string;
  correcta: string;
}

interface ExplicacionGenerada {
  preguntaId: string;
  porQueEstaMal: string;
  porQueLaCorrectaEsMejor: string;
}
