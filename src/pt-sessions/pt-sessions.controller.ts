import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { PtSessionsService } from './pt-sessions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('PT Sessions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pt-sessions')
export class PtSessionsController {
  constructor(private readonly ptSessionsService: PtSessionsService) {}

  @Get()
  async findAll(@Query() query: any, @CurrentUser() user: any) {
    if (user.role === Role.TRAINER) {
      const trainer = await this.ptSessionsService['prisma'].trainer.findFirst({ where: { userId: user.id } });
      return this.ptSessionsService.findAll(query, user.gymId, trainer?.id);
    }
    return this.ptSessionsService.findAll(query, user.gymId, query.trainerId);
  }

  @Get('admin-stats')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN)
  async getAdminStats(@CurrentUser() user: any) {
    return this.ptSessionsService.getAdminStats(user.gymId);
  }

  @Get('stats')
  @UseGuards(RolesGuard)
  @Roles(Role.TRAINER)
  async getStats(@CurrentUser() user: any) {
    const trainer = await this.ptSessionsService['prisma'].trainer.findFirst({ where: { userId: user.id } });
    if (!trainer) return { total: 0, scheduled: 0, completed: 0, cancelled: 0, thisWeek: 0, completionRate: 0 };
    return this.ptSessionsService.getStats(trainer.id, user.gymId);
  }

  @Get('available-trainers')
  @UseGuards(RolesGuard)
  @Roles(Role.MEMBER, Role.GYM_ADMIN, Role.SUPER_ADMIN)
  async getAvailableTrainers(@CurrentUser() user: any) {
    return this.ptSessionsService.getAvailableTrainers(user.gymId);
  }

  @Post('book')
  @UseGuards(RolesGuard)
  @Roles(Role.MEMBER)
  async bookWithPayment(@Body() body: any, @CurrentUser() user: any) {
    return this.ptSessionsService.bookWithPayment(body, user.gymId, user.id);
  }

  @Get('assigned-members')
  @UseGuards(RolesGuard)
  @Roles(Role.TRAINER)
  async getAssignedMembers(@CurrentUser() user: any) {
    const trainer = await this.ptSessionsService['prisma'].trainer.findFirst({ where: { userId: user.id } });
    if (!trainer) return [];
    return this.ptSessionsService.getAssignedMembers(trainer.id, user.gymId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.TRAINER)
  async create(@Body() body: any, @CurrentUser() user: any) {
    let trainerIdForCreate: string | undefined;
    if (user.role === Role.TRAINER) {
      const trainer = await this.ptSessionsService['prisma'].trainer.findFirst({ where: { userId: user.id } });
      trainerIdForCreate = trainer?.id;
    }
    return this.ptSessionsService.create(body, user.gymId, trainerIdForCreate);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.TRAINER)
  async update(@Param('id') id: string, @Body() body: any, @CurrentUser() user: any) {
    let trainerId: string | undefined;
    if (user.role === Role.TRAINER) {
      const trainer = await this.ptSessionsService['prisma'].trainer.findFirst({ where: { userId: user.id } });
      trainerId = trainer?.id;
    }
    return this.ptSessionsService.update(id, body, trainerId);
  }

  @Patch(':id/complete')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.TRAINER)
  async complete(@Param('id') id: string, @Body() body: { feedback?: string; rating?: number }, @CurrentUser() user: any) {
    let trainerId: string | undefined;
    if (user.role === Role.TRAINER) {
      const trainer = await this.ptSessionsService['prisma'].trainer.findFirst({ where: { userId: user.id } });
      trainerId = trainer?.id;
    }
    return this.ptSessionsService.complete(id, body.feedback, body.rating, trainerId);
  }

  @Patch(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.TRAINER)
  async cancel(@Param('id') id: string, @CurrentUser() user: any) {
    let trainerId: string | undefined;
    if (user.role === Role.TRAINER) {
      const trainer = await this.ptSessionsService['prisma'].trainer.findFirst({ where: { userId: user.id } });
      trainerId = trainer?.id;
    }
    return this.ptSessionsService.cancel(id, trainerId);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.TRAINER)
  async delete(@Param('id') id: string, @CurrentUser() user: any) {
    let trainerId: string | undefined;
    if (user.role === Role.TRAINER) {
      const trainer = await this.ptSessionsService['prisma'].trainer.findFirst({ where: { userId: user.id } });
      trainerId = trainer?.id;
    }
    return this.ptSessionsService.delete(id, trainerId);
  }
}
