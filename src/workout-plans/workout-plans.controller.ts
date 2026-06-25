import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { WorkoutPlansService } from './workout-plans.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Workout Plans')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workout-plans')
export class WorkoutPlansController {
  constructor(private readonly workoutPlansService: WorkoutPlansService) {}

  @Get('my')
  getMyPlans(@CurrentUser() user: any) {
    return this.workoutPlansService.findByUser(user.id, user.gymId);
  }

  @Post('ai-generate')
  generateAiPlan(@Body() body: { goal: string; level: string }, @CurrentUser() user: any) {
    return this.workoutPlansService.generateAiPlan(user.id, user.gymId, body.goal, body.level);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any, @CurrentUser() user: any) {
    return this.workoutPlansService.update(id, body, user.gymId);
  }

  // ── Premium Packages ──────────────────────────────────────────────────────

  @Get('packages')
  @UseGuards(RolesGuard)
  @Roles(Role.MEMBER, Role.GYM_ADMIN, Role.SUPER_ADMIN, Role.TRAINER)
  listPackages(@CurrentUser() user: any) {
    return this.workoutPlansService.listPackages(user.gymId);
  }

  @Post('packages')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN, Role.TRAINER)
  async createPackage(@Body() body: any, @CurrentUser() user: any) {
    let trainerId: string | undefined;
    if (user.role === Role.TRAINER) {
      const trainer = await (this.workoutPlansService as any).prisma.trainer.findFirst({ where: { userId: user.id } });
      trainerId = trainer?.id;
    }
    return this.workoutPlansService.createPackage(body, user.gymId, trainerId);
  }

  @Patch('packages/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN, Role.TRAINER)
  updatePackage(@Param('id') id: string, @Body() body: any, @CurrentUser() user: any) {
    return this.workoutPlansService.updatePackage(id, body, user.gymId);
  }

  @Post('packages/:id/buy')
  @UseGuards(RolesGuard)
  @Roles(Role.MEMBER)
  buyPackage(@Param('id') id: string, @Body() body: { useUpi?: boolean }, @CurrentUser() user: any) {
    return this.workoutPlansService.purchasePackage(id, user.id, user.gymId, !!body?.useUpi);
  }
}
