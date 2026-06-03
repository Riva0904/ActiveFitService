import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { RenewalRemindersService } from './renewal-reminders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('renewal-reminders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RenewalRemindersController {
  constructor(private readonly service: RenewalRemindersService) {}

  @Get('preview')
  @Roles('GYM_ADMIN')
  async preview(@CurrentUser() user: any) {
    return this.service.previewToday(user.gymId);
  }

  @Post('send-now')
  @Roles('GYM_ADMIN')
  async sendNow(@CurrentUser() user: any) {
    const sent = await this.service.processGym(user.gymId);
    return { sent, message: `${sent} renewal reminder(s) dispatched.` };
  }
}
