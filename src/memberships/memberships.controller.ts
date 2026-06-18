import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { MembershipsService } from './memberships.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateMembershipPlanDto, UpdateMembershipPlanDto } from './dto/membership-plan.dto';

@ApiTags('Memberships')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('memberships')
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.GYM_ADMIN, Role.MEMBER)
  findAll(@Query() query: any, @CurrentUser() user: any) {
    if (user.role === Role.MEMBER) {
      return this.membershipsService.findAll({ ...query, userId: user.id }, undefined);
    }
    const gymId = user.role === Role.GYM_ADMIN ? user.gymId : query.gymId;
    return this.membershipsService.findAll(query, gymId);
  }

  @Get('expiring')
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get expiring memberships' })
  getExpiring(@CurrentUser() user: any, @Query('days', new DefaultValuePipe(7), ParseIntPipe) days: number) {
    return this.membershipsService.getExpiringMembers(user.gymId, days);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get my memberships' })
  getMyMemberships(@CurrentUser() user: any) {
    return this.membershipsService.findAll({ limit: 10, userId: user.id }, user.gymId);
  }

  // ── Membership Plans ────────────────────────────────────────────────────

  @Get('plans')
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN, Role.MEMBER)
  @ApiOperation({ summary: 'Get all membership plans for gym' })
  findAllPlans(@CurrentUser() user: any) {
    const gymId = user.gymId;
    return this.membershipsService.findAllPlans(gymId);
  }

  @Post('plans')
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a membership plan' })
  createPlan(@Body() body: CreateMembershipPlanDto, @CurrentUser() user: any) {
    const gymId = user.role === Role.GYM_ADMIN ? user.gymId : (body.gymId ?? user.gymId);
    return this.membershipsService.createPlan(body, gymId);
  }

  @Get('plans/:planId')
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get a membership plan by ID' })
  findOnePlan(@Param('planId') planId: string, @CurrentUser() user: any) {
    return this.membershipsService.findOnePlan(planId, user.gymId);
  }

  @Patch('plans/:planId')
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a membership plan' })
  updatePlan(@Param('planId') planId: string, @Body() body: UpdateMembershipPlanDto, @CurrentUser() user: any) {
    const gymId = user.role === Role.GYM_ADMIN ? user.gymId : (body.gymId ?? user.gymId);
    return this.membershipsService.updatePlan(planId, body, gymId);
  }

  @Delete('plans/:planId')
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete (soft) a membership plan' })
  deletePlan(@Param('planId') planId: string, @CurrentUser() user: any) {
    return this.membershipsService.deletePlan(planId, user.gymId);
  }

  // ─────────────────────────────────────────────────────────────────────────

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.membershipsService.findOne(id, user.id, user.role);
  }

  @Post()
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN)
  create(@Body() body: any, @CurrentUser() user: any) {
    const gymId = user.role === Role.GYM_ADMIN ? user.gymId : (body.gymId ?? user.gymId);
    return this.membershipsService.create({ ...body, gymId });
  }

  @Patch(':id')
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN)
  update(@Param('id') id: string, @Body() body: any) {
    return this.membershipsService.update(id, body);
  }

  @Patch(':id/renew')
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Renew membership' })
  renew(@Param('id') id: string) {
    return this.membershipsService.renew(id);
  }
}
