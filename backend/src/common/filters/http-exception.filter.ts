import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * Normaliza cualquier HttpException (incluidas las que lanza el ValidationPipe
 * global por errores de class-validator) al shape de error documentado en
 * docs/arquitectura-base.md §6.1: { success: false, error: { message, errors? } }.
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const body = exception.getResponse();

    let message = exception.message;
    let errors: string[] | undefined;

    if (typeof body === 'object' && body !== null) {
      const raw = body as { message?: string | string[] };
      if (Array.isArray(raw.message)) {
        message = 'Error de validación';
        errors = raw.message;
      } else if (typeof raw.message === 'string') {
        message = raw.message;
      }
    }

    response.status(status).json({
      success: false,
      error: { message, ...(errors ? { errors } : {}) },
    });
  }
}
