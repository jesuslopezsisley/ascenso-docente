import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { UsuarioSanitizado } from '../services/auth.service';

export const CurrentUser = createParamDecorator(
  (field: keyof UsuarioSanitizado | undefined, ctx: ExecutionContext) => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ user: UsuarioSanitizado }>();
    return field ? request.user?.[field] : request.user;
  },
);
