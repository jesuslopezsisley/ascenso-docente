import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NivelEspecialidadController } from './controllers/nivel-especialidad.controller';
import { NivelEspecialidadService } from './services/nivel-especialidad.service';

@Module({
  imports: [PrismaModule],
  controllers: [NivelEspecialidadController],
  providers: [NivelEspecialidadService],
})
export class NivelEspecialidadModule {}
