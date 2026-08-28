import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface OpcionesIa {
  /**
   * JSON Schema para forzar la estructura de salida. Ollama lo usa en el
   * campo "format"; Gemini (por ahora) lo ignora y se guía por el prompt.
   */
  schema?: Record<string, unknown>;
  /**
   * Ventana de contexto explícita para Ollama. El default del modelo suele
   * ser chico y trunca las respuestas largas (planes de 6 semanas, lotes de
   * explicaciones). Si no se pasa, se usa OLLAMA_NUM_CTX.
   */
  numCtx?: number;
}

interface OllamaChatChunk {
  message?: { content?: string };
  done?: boolean;
  error?: string;
  total_duration?: number;
  eval_count?: number;
  prompt_eval_count?: number;
}

/**
 * Cliente para un servidor Ollama detrás de un proxy (p. ej.
 * https://ollama.nuiti.org). Aprendizajes que se aplican acá:
 *
 * - Endpoint NATIVO /api/chat, no el compatible con OpenAI: solo el nativo
 *   respeta `think: false` (evita que qwen3 emita bloques de razonamiento).
 * - `stream: true` obligatorio: el proxy corta las conexiones no-streamed
 *   que tardan mucho.
 * - `options.num_ctx` explícito: el default trunca respuestas largas.
 * - `format` con un JSON Schema para forzar el shape de salida.
 *
 * La respuesta de /api/chat con stream es NDJSON: una línea JSON por chunk
 * (`{ message: { content }, done: false }`) y una final con `done: true`.
 */
@Injectable()
export class OllamaService {
  private readonly logger = new Logger(OllamaService.name);

  constructor(private readonly config: ConfigService) {}

  async generarTexto(
    prompt: string,
    opciones: OpcionesIa = {},
  ): Promise<string> {
    const baseUrl = this.config
      .get<string>('OLLAMA_URL', 'https://ollama.nuiti.org')
      .replace(/\/+$/, '');
    const model = this.config.get<string>('OLLAMA_MODEL', 'qwen3:8b');
    const numCtx =
      opciones.numCtx ??
      Number(this.config.get<string>('OLLAMA_NUM_CTX', '8192'));

    const body = {
      model,
      messages: [{ role: 'user', content: prompt }],
      stream: true,
      think: false,
      options: { num_ctx: numCtx },
      ...(opciones.schema ? { format: opciones.schema } : {}),
    };

    let resp: Response;
    try {
      resp = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (error) {
      throw new ServiceUnavailableException(
        `No se pudo conectar con Ollama (${baseUrl}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    if (!resp.ok || !resp.body) {
      const detalle = await resp.text().catch(() => '');
      throw new ServiceUnavailableException(
        `Ollama respondió ${resp.status}: ${detalle.slice(0, 300)}`,
      );
    }

    const texto = await this.leerStreamNdjson(resp.body);
    if (!texto.trim()) {
      throw new ServiceUnavailableException('Ollama no devolvió contenido');
    }
    return texto;
  }

  private async leerStreamNdjson(
    stream: ReadableStream<Uint8Array>,
  ): Promise<string> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let texto = '';

    const procesarLinea = (linea: string) => {
      const limpia = linea.trim();
      if (!limpia) return;
      let chunk: OllamaChatChunk;
      try {
        chunk = JSON.parse(limpia) as OllamaChatChunk;
      } catch {
        return; // línea parcial improbable; el buffer la reintenta
      }
      if (chunk.error) {
        throw new ServiceUnavailableException(`Ollama: ${chunk.error}`);
      }
      if (typeof chunk.message?.content === 'string') {
        texto += chunk.message.content;
      }
      if (chunk.done) {
        this.logger.log(
          `Ollama done — tokens_salida=${chunk.eval_count ?? '?'} ` +
            `tokens_prompt=${chunk.prompt_eval_count ?? '?'} ` +
            `duracion=${
              chunk.total_duration
                ? Math.round(chunk.total_duration / 1e6) + 'ms'
                : '?'
            }`,
        );
      }
    };

    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf('\n')) !== -1) {
        procesarLinea(buffer.slice(0, nl));
        buffer = buffer.slice(nl + 1);
      }
    }
    procesarLinea(buffer);

    return texto;
  }
}
