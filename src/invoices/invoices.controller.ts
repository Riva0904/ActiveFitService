import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { InvoicesService } from './invoices.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN)
  findAll(@Query() query: any, @CurrentUser() user: any) {
    return this.invoicesService.findAll(query, user.gymId);
  }

  @Get('my')
  getMyInvoices(@CurrentUser('id') id: string) {
    return this.invoicesService.getMyInvoices(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.invoicesService.findOne(id, user.id, user.role);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN)
  create(@Body() body: any, @CurrentUser() user: any) {
    return this.invoicesService.create({ ...body, gymId: user.gymId });
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN)
  updateStatus(@Param('id') id: string, @Body('status') status: any) {
    return this.invoicesService.updateStatus(id, status);
  }
}
