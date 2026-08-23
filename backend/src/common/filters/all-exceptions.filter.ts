import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * Catch-all para cualquier excepción no controlada (no HttpException).
 * A diferencia del repo analizado en docs/arquitectura-base.md (§9, deuda
 * conocida), aquí el stack trace NUNCA se expone en la respuesta; solo se
 * loguea del lado del servidor.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    this.logger.error(exception instanceof Error ? exception.stack : exception);

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: { message: 'Error interno del servidor' },
    });
  }
}
