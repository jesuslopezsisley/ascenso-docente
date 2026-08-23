import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NivelEspecialidadService {
  constructor(private prisma: PrismaService) {}

  async listar() {
    return this.prisma.nivelEspecialidad.findMany({
      select: { id: true, nivel: true, especialidad: true, nombre: true },
      orderBy: { nombre: 'asc' },
    });
  }
}
