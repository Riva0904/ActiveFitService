import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const SKIP_GYM_SCOPE_KEY = 'skipGymScope';

@Injectable()
export class GymScopeGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_GYM_SCOPE_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (skip) return true;

    const req = ctx.switchToHttp().getRequest();
    const user = req.user;
    if (!user) return true; // let JwtAuthGuard handle the 401

    if (user.role === 'SUPER_ADMIN') return true; // super admin crosses gym boundaries

    if (!user.gymId) throw new ForbiddenException('No gym context — cannot access gym-scoped resource');

    // Attach gymId directly on the request for downstream use
    req.gymId = user.gymId;
    return true;
  }
}
