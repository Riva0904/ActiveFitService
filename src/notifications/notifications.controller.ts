import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll(@CurrentUser('id') id: string) {
    return this.notificationsService.findAll(id);
  }

  @Get('unread-count')
  getUnreadCount(@CurrentUser('id') id: string) {
    return this.notificationsService.getUnreadCount(id);
  }

  @Patch(':id/read')
  markAsRead(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.notificationsService.markAsRead(id, userId);
  }

  @Patch('read-all')
  markAllAsRead(@CurrentUser('id') id: string) {
    return this.notificationsService.markAllAsRead(id);
  }

  @Post('broadcast')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN)
  broadcast(@Body() body: { title: string; message: string; type: any }, @CurrentUser() user: any) {
    return this.notificationsService.broadcast(user.gymId, body);
  }
}
