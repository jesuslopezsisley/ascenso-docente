import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard básico para proteger rutas. No hay guard global ni decorador
 * @Public: toda ruta que no lleve @UseGuards(JwtAuthGuard) es pública por
 * diseño (docs/arquitectura-base.md §3.3).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
