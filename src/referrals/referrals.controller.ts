import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ReferralsService } from './referrals.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('referrals')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReferralsController {
  constructor(private readonly service: ReferralsService) {}

  @Get('my')
  @Roles('MEMBER')
  getMyInfo(@CurrentUser() user: any) {
    return this.service.getMyInfo(user.id, user.gymId);
  }

  @Get('admin/:memberId')
  @Roles('GYM_ADMIN')
  getAdminChain(@Param('memberId') memberId: string, @CurrentUser() user: any) {
    return this.service.getAdminChain(memberId, user.gymId);
  }
}
