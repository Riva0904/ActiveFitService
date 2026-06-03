import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PointsService } from './points.service';
import { BadgeService } from './badge.service';

@ApiTags('Gamification')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('gamification')
export class GamificationController {
  constructor(
    private pointsService: PointsService,
    private badgeService: BadgeService,
  ) {}

  @Get('my/points')
  async getMyPoints(@CurrentUser() user: any) {
    const member = { id: user.memberId ?? user.id }; // resolved from JWT claim
    return { points: await this.pointsService.getMemberPoints(member.id, user.gymId) };
  }

  @Get('my/badges')
  async getMyBadges(@CurrentUser() user: any) {
    return this.badgeService.getMemberBadges(user.memberId ?? user.id, user.gymId);
  }

  @Get('leaderboard')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.MEMBER, Role.TRAINER, Role.STAFF)
  getLeaderboard(@CurrentUser() user: any, @Query('limit') limit?: number) {
    return this.pointsService.getGymLeaderboard(user.gymId, limit ? +limit : 10);
  }
}
