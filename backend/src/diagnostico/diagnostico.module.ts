import { Module } from '@nestjs/common';
import { IaModule } from '../ia/ia.module';
import { PrismaModule } from '../prisma/prisma.module';
import { DiagnosticoController } from './controllers/diagnostico.controller';
import { DemoModeGuard } from './guards/demo-mode.guard';
import { DiagnosticoService } from './services/diagnostico.service';
import { ExplicacionesService } from './services/explicaciones.service';

@Module({
  imports: [PrismaModule, IaModule],
  controllers: [DiagnosticoController],
  providers: [DiagnosticoService, ExplicacionesService, DemoModeGuard],
  exports: [DiagnosticoService],
})
export class DiagnosticoModule {}
