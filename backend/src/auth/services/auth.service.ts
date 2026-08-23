import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from '../dto/register.dto';

const SALT_ROUNDS = 10;

export interface UsuarioSanitizado {
  id: string;
  email: string;
  nombre: string;
  nivelEspecialidadId: string;
}

function sanitizar<T extends { password: string }>(
  usuario: T,
): Omit<T, 'password'> {
  const resto: Partial<T> = { ...usuario };
  delete resto.password;
  return resto as Omit<T, 'password'>;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existente = await this.prisma.usuario.findUnique({
      where: { email: dto.email },
    });
    if (existente) {
      throw new BadRequestException('Ya existe un usuario con ese correo');
    }

    const nivelEspecialidad = await this.prisma.nivelEspecialidad.findUnique({
      where: { id: dto.nivelEspecialidadId },
    });
    if (!nivelEspecialidad) {
      throw new BadRequestException('nivelEspecialidadId no es válido');
    }

    const password = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const usuario = await this.prisma.usuario.create({
      data: {
        email: dto.email,
        password,
        nombre: dto.nombre,
        nivelEspecialidadId: dto.nivelEspecialidadId,
      },
    });

    return this.emitirToken(sanitizar(usuario));
  }

  /** Usado por LocalStrategy durante el login. */
  async validarCredenciales(email: string, password: string) {
    const usuario = await this.prisma.usuario.findUnique({ where: { email } });
    if (!usuario) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const passwordValido = await bcrypt.compare(password, usuario.password);
    if (!passwordValido) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    return sanitizar(usuario);
  }

  /** Recibe el usuario ya validado por LocalStrategy (req.user) y emite el token. */
  login(usuario: UsuarioSanitizado) {
    return this.emitirToken(usuario);
  }

  /** Usado por JwtStrategy: enriquece el payload del token con el perfil actual. */
  async validarUsuarioPorId(id: string): Promise<UsuarioSanitizado> {
    const usuario = await this.prisma.usuario.findUnique({ where: { id } });
    if (!usuario) {
      throw new UnauthorizedException('El usuario ya no existe');
    }
    return sanitizar(usuario);
  }

  private emitirToken(usuario: UsuarioSanitizado) {
    const accessToken = this.jwt.sign({
      sub: usuario.id,
      email: usuario.email,
    });
    return { user: usuario, accessToken };
  }
}
