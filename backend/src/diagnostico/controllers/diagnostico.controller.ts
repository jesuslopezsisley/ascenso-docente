import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { UsuarioSanitizado } from '../../auth/services/auth.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ResponderDto } from '../dto/responder.dto';
import { SimularDto } from '../dto/simular.dto';
import { DemoModeGuard } from '../guards/demo-mode.guard';
import { DiagnosticoService } from '../services/diagnostico.service';

@ApiTags('Diagnostico')
@Controller('diagnostico')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DiagnosticoController {
  constructor(private readonly diagnosticoService: DiagnosticoService) {}

  @Post()
  @ApiOperation({
    summary:
      'Crea un diagnóstico para el usuario autenticado con las 60 preguntas de su especialidad',
  })
  @ApiResponse({ status: 201, description: 'Diagnóstico creado' })
  async crear(@CurrentUser() user: UsuarioSanitizado) {
    const data = await this.diagnosticoService.crear(
      user.id,
      user.nivelEspecialidadId,
    );
    return { message: 'Diagnóstico creado', data };
  }

  @Post(':id/responder')
  @ApiOperation({
    summary: 'Registra la respuesta a una pregunta del diagnóstico',
  })
  @ApiResponse({ status: 201, description: 'Respuesta guardada' })
  async responder(
    @Param('id') id: string,
    @CurrentUser('id') usuarioId: string,
    @Body() dto: ResponderDto,
  ) {
    const data = await this.diagnosticoService.responder(id, usuarioId, dto);
    return { message: 'Respuesta registrada', data };
  }

  @Post(':id/finalizar')
  @ApiOperation({
    summary: 'Finaliza el diagnóstico y devuelve el reporte por competencia',
  })
  @ApiResponse({ status: 200, description: 'Reporte del diagnóstico' })
  async finalizar(
    @Param('id') id: string,
    @CurrentUser('id') usuarioId: string,
  ) {
    const data = await this.diagnosticoService.finalizar(id, usuarioId);
    return { message: 'Diagnóstico finalizado', data };
  }

  @Post(':id/plan-estudio')
  @ApiOperation({
    summary:
      'Genera (o regenera) con IA un plan de estudio estructurado a partir del reporte del diagnóstico finalizado',
  })
  @ApiResponse({ status: 201, description: 'Plan de estudio generado' })
  async planEstudio(
    @Param('id') id: string,
    @CurrentUser('id') usuarioId: string,
  ) {
    const data = await this.diagnosticoService.generarPlanEstudio(
      id,
      usuarioId,
    );
    return { message: 'Plan de estudio generado', data };
  }

  @Post(':id/plan-estudio/sesiones/:sesionId/completar')
  @ApiOperation({
    summary: 'Marca una sesión del plan de estudio como completada',
  })
  @ApiResponse({ status: 200, description: 'Sesión marcada como completada' })
  async completarSesion(
    @Param('id') id: string,
    @Param('sesionId') sesionId: string,
    @CurrentUser('id') usuarioId: string,
  ) {
    const data = await this.diagnosticoService.completarSesion(
      id,
      usuarioId,
      sesionId,
    );
    return { message: 'Sesión marcada como completada', data };
  }

  @Get(':id/plan-estudio/progreso')
  @ApiOperation({
    summary:
      'Devuelve el progreso del plan de estudio (para la pantalla de inicio)',
  })
  @ApiResponse({ status: 200, description: 'Progreso del plan de estudio' })
  async progreso(
    @Param('id') id: string,
    @CurrentUser('id') usuarioId: string,
  ) {
    const data = await this.diagnosticoService.obtenerProgreso(id, usuarioId);
    return { message: 'Progreso obtenido', data };
  }

  @UseGuards(DemoModeGuard)
  @Post(':id/simular')
  @ApiOperation({
    summary: '[Solo DEMO_MODE=true] Simula respuestas a las 60 preguntas',
  })
  @ApiResponse({ status: 201, description: 'Respuestas simuladas' })
  async simular(
    @Param('id') id: string,
    @CurrentUser('id') usuarioId: string,
    @Body() dto: SimularDto,
  ) {
    const data = await this.diagnosticoService.simular(
      id,
      usuarioId,
      dto.patrones,
    );
    return { message: 'Simulación completada', data };
  }
}
