import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../decorators/current-user.decorator';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { LocalAuthGuard } from '../guards/local-auth.guard';
import { AuthService } from '../services/auth.service';
import type { UsuarioSanitizado } from '../services/auth.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Registra un nuevo usuario y devuelve su token' })
  @ApiResponse({ status: 201, description: 'Usuario registrado' })
  async register(@Body() dto: RegisterDto) {
    const data = await this.authService.register(dto);
    return { message: 'Usuario registrado correctamente', data };
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  @ApiOperation({ summary: 'Inicia sesión con email y contraseña' })
  @ApiResponse({ status: 200, description: 'Inicio de sesión exitoso' })
  login(@Body() _dto: LoginDto, @Req() req: { user: UsuarioSanitizado }) {
    // LocalAuthGuard ya validó las credenciales (ver LocalStrategy) y dejó
    // el usuario en req.user; aquí solo se emite el token.
    const data = this.authService.login(req.user);
    return { message: 'Inicio de sesión exitoso', data };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Devuelve el perfil del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Perfil del usuario' })
  me(@CurrentUser() user: UsuarioSanitizado) {
    return { message: 'Perfil obtenido', data: user };
  }
}
