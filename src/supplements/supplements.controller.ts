import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { SupplementsService } from './supplements.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Supplements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('supplements')
export class SupplementsController {
  constructor(private readonly supplementsService: SupplementsService) {}

  @Get()
  findAll(@Query() query: any, @CurrentUser() user: any) {
    return this.supplementsService.findAll(query, user.gymId);
  }

  @Get('orders')
  getOrders(@Query() query: any, @CurrentUser() user: any) {
    const gymId = user.role !== Role.MEMBER ? user.gymId : undefined;
    const userId = user.role === Role.MEMBER ? user.id : query.userId;
    return this.supplementsService.getOrders(query, gymId, userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.supplementsService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN)
  create(@Body() body: any, @CurrentUser() user: any) {
    return this.supplementsService.create({ ...body, gymId: user.gymId });
  }

  @Post('order')
  createOrder(@Body() body: { items: any[] }, @CurrentUser() user: any) {
    return this.supplementsService.createOrder(user.id, user.gymId, body.items);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN)
  update(@Param('id') id: string, @Body() body: any) {
    return this.supplementsService.update(id, body);
  }

  @Patch(':id/stock')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN)
  updateStock(@Param('id') id: string, @Body('quantity') quantity: number) {
    return this.supplementsService.updateStock(id, quantity);
  }

  @Patch('orders/:orderId/status')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN)
  updateOrderStatus(@Param('orderId') orderId: string, @Body('status') status: any) {
    return this.supplementsService.updateOrderStatus(orderId, status);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.supplementsService.remove(id, user.gymId);
  }
}
