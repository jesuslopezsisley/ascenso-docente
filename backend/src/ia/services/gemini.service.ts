import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';

/**
 * Wrapper genérico sobre @google/genai (SDK oficial vigente; el paquete
 * anterior @google/generative-ai quedó deprecado en agosto de 2025).
 * El cliente se crea de forma perezosa: si falta GEMINI_API_KEY, el resto
 * de la app arranca igual y solo falla la primera llamada a generarTexto().
 */
@Injectable()
export class GeminiService {
  private client: GoogleGenAI | null = null;

  constructor(private readonly config: ConfigService) {}

  private getClient(): GoogleGenAI {
    if (!this.client) {
      const apiKey = this.config.get<string>('GEMINI_API_KEY');
      if (!apiKey) {
        throw new ServiceUnavailableException(
          'GEMINI_API_KEY no está configurado',
        );
      }
      this.client = new GoogleGenAI({ apiKey });
    }
    return this.client;
  }

  async generarTexto(prompt: string): Promise<string> {
    const ai = this.getClient();
    const model = this.config.get<string>('GEMINI_MODEL', 'gemini-3.6-flash');

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });

    const texto = response.text;
    if (!texto) {
      throw new ServiceUnavailableException('Gemini no devolvió contenido');
    }
    return texto;
  }
}
