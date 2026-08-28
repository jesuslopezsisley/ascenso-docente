import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeminiService } from './gemini.service';
import { OllamaService, type OpcionesIa } from './ollama.service';

export type ProveedorIa = 'gemini' | 'ollama';

/**
 * Fachada de generación de texto con IA. El proveedor se elige con la
 * variable PROVEEDOR_IA (gemini | ollama), default gemini — no se cambia
 * el comportamiento de producción salvo que se setee explícitamente.
 *
 * Ollama existe como alternativa temporal mientras el crédito de Gemini
 * está agotado; se mide calidad antes de decidir si se promueve.
 */
@Injectable()
export class IaService {
  private readonly logger = new Logger(IaService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly gemini: GeminiService,
    private readonly ollama: OllamaService,
  ) {}

  get proveedor(): ProveedorIa {
    return this.config.get<string>('PROVEEDOR_IA', 'gemini') === 'ollama'
      ? 'ollama'
      : 'gemini';
  }

  /**
   * `opciones.schema` (JSON Schema) solo lo aprovecha Ollama; con Gemini el
   * shape lo sigue guiando el prompt, como hasta ahora.
   */
  async generarTexto(
    prompt: string,
    opciones: OpcionesIa = {},
  ): Promise<string> {
    if (this.proveedor === 'ollama') {
      this.logger.log('Generando texto con Ollama');
      return this.ollama.generarTexto(prompt, opciones);
    }
    return this.gemini.generarTexto(prompt);
  }
}
