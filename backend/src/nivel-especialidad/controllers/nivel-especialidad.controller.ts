import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { NivelEspecialidadService } from '../services/nivel-especialidad.service';

@ApiTags('NivelEspecialidad')
@Controller('nivel-especialidad')
export class NivelEspecialidadController {
  constructor(private readonly service: NivelEspecialidadService) {}

  @Get()
  @ApiOperation({
    summary:
      'Lista los NivelEspecialidad sembrados, para poblar el selector de registro',
  })
  @ApiResponse({ status: 200, description: 'Lista de NivelEspecialidad' })
  async listar() {
    const data = await this.service.listar();
    return { message: 'NivelEspecialidad obtenidos', data };
  }
}
