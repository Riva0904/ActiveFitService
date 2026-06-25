import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { SalaryPayoutsService } from './salary-payouts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Salary Payouts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('salary-payouts')
export class SalaryPayoutsController {
  constructor(private readonly service: SalaryPayoutsService) {}

  @Post()
  @Roles(Role.GYM_ADMIN)
  create(@Body() body: { userId: string; amount: number; periodLabel: string; notes?: string }, @CurrentUser() user: any) {
    return this.service.create(user.gymId, body);
  }

  @Get()
  @Roles(Role.GYM_ADMIN)
  findAll(@Query() query: any, @CurrentUser() user: any) {
    return this.service.findAllForGym(user.gymId, query);
  }

  @Get('my')
  @Roles(Role.TRAINER, Role.STAFF)
  findMine(@CurrentUser() user: any) {
    return this.service.findMine(user.id);
  }

  @Patch(':id/mark-paid')
  @Roles(Role.GYM_ADMIN)
  markPaid(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.markPaid(id, user.gymId);
  }
}
