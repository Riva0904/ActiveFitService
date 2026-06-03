import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MobileService } from './mobile.service';

@ApiTags('Mobile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('mobile')
export class MobileController {
  constructor(private mobileService: MobileService) {}

  /**
   * Single endpoint returns everything the mobile home screen needs:
   * profile + active membership + today's workout + today's diet + attendance status.
   * Replaces 5 separate API calls on app startup.
   */
  @Get('home')
  getHomeData(@CurrentUser() user: any) {
    return this.mobileService.getHomeData(user.id, user.gymId);
  }

  /** Register a FCM/APNs push token for this device */
  @Post('push-token')
  registerPushToken(@CurrentUser() user: any, @Body() body: { token: string; platform: 'ios' | 'android' }) {
    return this.mobileService.registerPushToken(user.id, body.token, body.platform);
  }

  /** Offline-safe check-in: accepts a pre-signed member QR token */
  @Post('checkin')
  mobileCheckIn(@CurrentUser() user: any, @Body() body: { gymId: string }) {
    return this.mobileService.selfCheckIn(user.id, body.gymId ?? user.gymId);
  }
}
