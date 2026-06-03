import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenBlacklistService } from '../token-blacklist.service';

function extractFromCookieOrBearer(req: Request): string | null {
  const cookieHeader = req.headers.cookie ?? '';
  const cookieToken = cookieHeader.split(';').reduce<string | null>((found, part) => {
    if (found) return found;
    const [key, val] = part.trim().split('=');
    return key === 'ab_token' ? decodeURIComponent(val ?? '') : null;
  }, null);
  if (cookieToken) return cookieToken;
  const authHeader = req.headers.authorization ?? '';
  if (authHeader.startsWith('Bearer ')) return authHeader.slice(7);
  return null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private tokenBlacklist: TokenBlacklistService,
  ) {
    super({
      jwtFromRequest: extractFromCookieOrBearer,
      passReqToCallback: false,
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: { sub: string; email: string; role: string; jti?: string }) {
    if (payload.jti && await this.tokenBlacklist.has(payload.jti)) {
      throw new UnauthorizedException('Token has been revoked');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        gymId: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return { ...user, jti: payload.jti };
  }
}
