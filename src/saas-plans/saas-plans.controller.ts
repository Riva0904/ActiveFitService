import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { SaasPlansService } from './saas-plans.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('SaaS Plans')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('saas-plans')
export class SaasPlansController {
  constructor(private readonly saasPlansService: SaasPlansService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all SaaS subscription plans' })
  findAll() {
    return this.saasPlansService.findAll();
  }

  @Post('init')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Initialize default SaaS plans if not present' })
  initDefaults() {
    return this.saasPlansService.initDefaults();
  }

  @Get('revenue')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get platform commission revenue stats' })
  getPlatformRevenue() {
    return this.saasPlansService.getPlatformRevenue();
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get SaaS plan by ID' })
  findOne(@Param('id') id: string) {
    return this.saasPlansService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update SaaS subscription plan' })
  update(@Param('id') id: string, @Body() body: any) {
    return this.saasPlansService.update(id, body);
  }
}
