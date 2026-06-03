import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RetentionService } from './retention.service';
import { RevenueService } from './revenue.service';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(
    private retentionService: RetentionService,
    private revenueService: RevenueService,
  ) {}

  // ─── Gym Admin Analytics ──────────────────────────────────────────────────

  @Get('retention/at-risk')
  @Roles(Role.GYM_ADMIN)
  getAtRiskMembers(@CurrentUser() user: any, @Query('days') days?: number) {
    return this.retentionService.getAtRiskMembers(user.gymId, days ? +days : 14);
  }

  @Get('retention/attendance-rates')
  @Roles(Role.GYM_ADMIN)
  getAttendanceRates(@CurrentUser() user: any, @Query('days') days?: number) {
    return this.retentionService.getAttendanceRates(user.gymId, days ? +days : 30);
  }

  @Get('retention/churned')
  @Roles(Role.GYM_ADMIN)
  getChurnedMembers(@CurrentUser() user: any, @Query('days') days?: number) {
    return this.retentionService.getChurnedMembers(user.gymId, days ? +days : 30);
  }

  @Get('growth')
  @Roles(Role.GYM_ADMIN)
  getMemberGrowth(@CurrentUser() user: any, @Query('weeks') weeks?: number) {
    return this.retentionService.getMemberGrowth(user.gymId, weeks ? +weeks : 12);
  }

  @Get('revenue')
  @Roles(Role.GYM_ADMIN)
  getRevenueStats(@CurrentUser() user: any) {
    return this.revenueService.getGymRevenueStats(user.gymId);
  }

  @Get('revenue/monthly')
  @Roles(Role.GYM_ADMIN)
  getMonthlyBreakdown(@CurrentUser() user: any, @Query('months') months?: number) {
    return this.revenueService.getMonthlyBreakdown(user.gymId, months ? +months : 6);
  }

  // ─── Super Admin Analytics ────────────────────────────────────────────────

  @Get('platform/revenue')
  @Roles(Role.SUPER_ADMIN)
  getPlatformRevenue() {
    return this.revenueService.getPlatformRevenue();
  }
}
