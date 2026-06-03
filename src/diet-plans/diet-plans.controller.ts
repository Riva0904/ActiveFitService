import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { DietPlansService } from './diet-plans.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Diet Plans')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('diet-plans')
export class DietPlansController {
  constructor(private readonly dietPlansService: DietPlansService) {}

  @Get('my')
  getMyPlans(@CurrentUser() user: any) {
    return this.dietPlansService.findByUser(user.id, user.gymId);
  }

  @Post('ai-generate')
  generateAi(@Body() body: { goal: string; calories: number }, @CurrentUser() user: any) {
    return this.dietPlansService.generateAiDiet(user.id, user.gymId, body.goal, body.calories);
  }

  // ── Premium Packages ──────────────────────────────────────────────────────

  @Get('packages')
  @UseGuards(RolesGuard)
  @Roles(Role.MEMBER, Role.GYM_ADMIN, Role.SUPER_ADMIN, Role.TRAINER)
  listPackages(@CurrentUser() user: any) {
    return this.dietPlansService.listPackages(user.gymId);
  }

  @Post('packages')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN, Role.TRAINER)
  async createPackage(@Body() body: any, @CurrentUser() user: any) {
    let trainerId: string | undefined;
    if (user.role === Role.TRAINER) {
      const trainer = await (this.dietPlansService as any).prisma.trainer.findFirst({ where: { userId: user.id } });
      trainerId = trainer?.id;
    }
    return this.dietPlansService.createPackage(body, user.gymId, trainerId);
  }

  @Patch('packages/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN, Role.TRAINER)
  updatePackage(@Param('id') id: string, @Body() body: any, @CurrentUser() user: any) {
    return this.dietPlansService.updatePackage(id, body, user.gymId);
  }

  @Post('packages/:id/buy')
  @UseGuards(RolesGuard)
  @Roles(Role.MEMBER)
  buyPackage(@Param('id') id: string, @CurrentUser() user: any) {
    return this.dietPlansService.purchasePackage(id, user.id, user.gymId);
  }
}
