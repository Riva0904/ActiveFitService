import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { TrainersService } from './trainers.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Trainers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('trainers')
export class TrainersController {
  constructor(
    private readonly trainersService: TrainersService,
    private readonly usersService: UsersService,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN)
  create(@Body() body: any, @CurrentUser() user: any) {
    return this.usersService.createUser({ ...body, role: 'TRAINER' }, user.role, user.gymId);
  }

  @Get()
  findAll(@Query() query: any, @CurrentUser() user: any) {
    const gymId = user.role === Role.GYM_ADMIN ? user.gymId : query.gymId;
    return this.trainersService.findAll(query, gymId);
  }

  @Get('performance')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN)
  getPerformance(@CurrentUser() user: any) {
    return this.trainersService.getPerformance(user.gymId);
  }

  @Get('my-dashboard')
  @UseGuards(RolesGuard)
  @Roles(Role.TRAINER)
  getMyDashboard(@CurrentUser() user: any) {
    return this.trainersService.getMyDashboardStats(user.id, user.gymId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.trainersService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN)
  update(@Param('id') id: string, @Body() body: any) {
    return this.trainersService.update(id, body);
  }

  @Post(':id/assign')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN)
  assignMember(@Param('id') id: string, @Body('memberId') memberId: string, @CurrentUser() user: any) {
    return this.trainersService.assignMember(id, memberId, user.gymId);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN)
  remove(@Param('id') id: string) {
    return this.trainersService.remove(id);
  }
}
