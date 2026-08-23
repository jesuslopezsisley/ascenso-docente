import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DiagnosticoModule } from './diagnostico/diagnostico.module';
import { NivelEspecialidadModule } from './nivel-especialidad/nivel-especialidad.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    PrismaModule,
    AuthModule,
    DiagnosticoModule,
    NivelEspecialidadModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
