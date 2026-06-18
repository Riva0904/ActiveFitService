import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  // ─── Admin-only endpoints ─────────────────────────────────────────────────

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN, Role.STAFF)
  findAll(@Query() query: any, @CurrentUser() user: any) {
    const gymId = [Role.GYM_ADMIN, Role.STAFF].includes(user.role) ? user.gymId : query.gymId;
    return this.attendanceService.findAll(query, gymId);
  }

  @Get('stats/today')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Get today attendance stats' })
  getTodayStats(@CurrentUser() user: any) {
    return this.attendanceService.getTodayStats(user.gymId);
  }

  @Get('stats/weekly')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Get weekly attendance report' })
  getWeeklyReport(@CurrentUser() user: any) {
    return this.attendanceService.getWeeklyReport(user.gymId);
  }

  @Post('qr-check-in')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN)
  @ApiOperation({ summary: 'Admin kiosk: scan member QR or enter member ID' })
  qrCheckIn(@Body('qrCode') qrCode: string, @CurrentUser() user: any) {
    return this.attendanceService.checkInByQr(qrCode, user.gymId);
  }

  @Post('admin-manual-check-in')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Admin: check-in/out any member, trainer, or staff by their ID code' })
  adminManualCheckIn(@Body('code') code: string, @CurrentUser() user: any) {
    return this.attendanceService.adminManualCheckIn(code, user.gymId);
  }

  @Post('check-in')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.STAFF, Role.MEMBER)
  @ApiOperation({ summary: 'Admin/Staff: manual check-in for self. Member: explicit check-in (smart QR flow)' })
  checkIn(@CurrentUser() user: any) {
    return user.role === Role.MEMBER
      ? this.attendanceService.memberCheckIn(user.id, user.gymId)
      : this.attendanceService.checkIn(user.id, user.gymId);
  }

  @Patch(':id/check-out')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Admin: manual check-out' })
  checkOut(@Param('id') id: string, @CurrentUser() user: any) {
    return this.attendanceService.checkOut(id, user.id);
  }

  // ─── Member / Trainer / Staff endpoints ───────────────────────────────────

  @Post('self-check-in')
  @ApiOperation({ summary: 'Member/Trainer/Staff: self check-in via gym QR scan' })
  selfCheckIn(@CurrentUser() user: any) {
    return this.attendanceService.selfCheckIn(user.id, user.gymId);
  }

  @Get('my-status')
  @ApiOperation({ summary: 'Check if currently checked in today' })
  getMyStatus(@CurrentUser() user: any) {
    return this.attendanceService.getMyStatus(user.id, user.gymId);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get own attendance history' })
  getMyAttendance(@CurrentUser() user: any, @Query() query: any) {
    return this.attendanceService.getMyAttendance(user.id, user.gymId, query);
  }

  // ─── Smart QR flow: explicit member check-in/check-out (not a toggle) ────

  @Post('check-out')
  @UseGuards(RolesGuard)
  @Roles(Role.MEMBER)
  @ApiOperation({ summary: 'Member: explicit check-out (smart QR flow)' })
  memberCheckOut(@CurrentUser() user: any) {
    return this.attendanceService.memberCheckOut(user.id, user.gymId);
  }

  @Get('status')
  @UseGuards(RolesGuard)
  @Roles(Role.MEMBER)
  @ApiOperation({ summary: 'Member: current check-in status (smart QR flow)' })
  getStatus(@CurrentUser() user: any) {
    return this.attendanceService.getStatus(user.id, user.gymId);
  }

  @Get('history')
  @UseGuards(RolesGuard)
  @Roles(Role.MEMBER)
  @ApiOperation({ summary: 'Member: formatted attendance history (smart QR flow)' })
  getHistory(@CurrentUser() user: any, @Query() query: any) {
    return this.attendanceService.getHistory(user.id, user.gymId, query);
  }

  // ─── Staff/Admin: explicit manual check-in/check-out (not a toggle) ──────

  @Post('manual-check-in')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Staff/Admin: explicit manual check-in by ID code' })
  manualCheckIn(@Body('code') code: string, @CurrentUser() user: any) {
    return this.attendanceService.manualCheckIn(code, user.gymId, user.id);
  }

  @Post('manual-check-out')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Staff/Admin: explicit manual check-out by ID code' })
  manualCheckOut(@Body('code') code: string, @CurrentUser() user: any) {
    return this.attendanceService.manualCheckOut(code, user.gymId);
  }

  // ─── Occupancy & analytics ─────────────────────────────────────────────────

  @Get('occupancy')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Live gym occupancy (currently-in count vs capacity)' })
  getOccupancy(@CurrentUser() user: any) {
    return this.attendanceService.getOccupancy(user.gymId);
  }

  @Get('analytics')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Attendance analytics: avg duration, daily/monthly trend, peak hours, most active members' })
  getAnalytics(@CurrentUser() user: any) {
    return this.attendanceService.getAnalytics(user.gymId);
  }
}
