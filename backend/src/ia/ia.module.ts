import { Module } from '@nestjs/common';
import { GeminiService } from './services/gemini.service';
import { IaService } from './services/ia.service';
import { OllamaService } from './services/ollama.service';

@Module({
  providers: [GeminiService, OllamaService, IaService],
  exports: [IaService, GeminiService],
})
export class IaModule {}
