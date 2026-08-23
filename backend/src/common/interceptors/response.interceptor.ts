import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: true;
  message: string;
  data: T;
}

interface HandlerResult<T> {
  message?: string;
  data?: T;
}

/**
 * Cada handler retorna { message, data }; este interceptor lo envuelve en el
 * shape de respuesta final documentado en docs/arquitectura-base.md §6.1.
 */
@Injectable()
export class ApiResponseInterceptor<T> implements NestInterceptor<
  HandlerResult<T>,
  ApiResponse<T>
> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<HandlerResult<T>>,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((result) => ({
        success: true as const,
        message: result?.message ?? 'OK',
        data: result?.data as T,
      })),
    );
  }
}
