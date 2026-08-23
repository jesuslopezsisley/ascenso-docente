import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Protege endpoints de solo-demo: si DEMO_MODE no es "true", el endpoint
 * responde 404 como si no existiera, en vez de 403 (no queremos revelar que
 * la ruta existe fuera del entorno de demo).
 */
@Injectable()
export class DemoModeGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(): boolean {
    if (this.config.get<string>('DEMO_MODE') !== 'true') {
      throw new NotFoundException();
    }
    return true;
  }
}
