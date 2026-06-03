import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { LeaveService } from './leave.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Leave Requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('leave-requests')
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.STAFF, Role.TRAINER)
  applyLeave(@CurrentUser() user: any, @Body() body: any) {
    return this.leaveService.applyLeave(user.gymId, user.id, body);
  }

  @Get('my')
  @UseGuards(RolesGuard)
  @Roles(Role.STAFF, Role.TRAINER)
  getMyLeaves(@CurrentUser() user: any, @Query() query: any) {
    return this.leaveService.getMyLeaves(user.id, query);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN)
  getAllLeaves(@CurrentUser() user: any, @Query() query: any) {
    return this.leaveService.getAllLeaves(user.gymId, query);
  }

  @Patch(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN)
  approveLeave(@Param('id') id: string, @CurrentUser() user: any, @Body() body: any) {
    return this.leaveService.reviewLeave(user.gymId, id, user.id, 'APPROVED', body.adminNote);
  }

  @Patch(':id/reject')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN)
  rejectLeave(@Param('id') id: string, @CurrentUser() user: any, @Body() body: any) {
    return this.leaveService.reviewLeave(user.gymId, id, user.id, 'REJECTED', body.adminNote);
  }
}
