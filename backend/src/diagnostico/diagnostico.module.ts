import { Module } from '@nestjs/common';
import { IaModule } from '../ia/ia.module';
import { PrismaModule } from '../prisma/prisma.module';
import { DiagnosticoController } from './controllers/diagnostico.controller';
import { DemoModeGuard } from './guards/demo-mode.guard';
import { DiagnosticoService } from './services/diagnostico.service';

@Module({
  imports: [PrismaModule, IaModule],
  controllers: [DiagnosticoController],
  providers: [DiagnosticoService, DemoModeGuard],
  exports: [DiagnosticoService],
})
export class DiagnosticoModule {}
