import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Expenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.GYM_ADMIN)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  create(@Body() dto: CreateExpenseDto, @CurrentUser() user: any) {
    return this.expensesService.create(dto, user.gymId);
  }

  @Get()
  findAll(@Query() query: any, @CurrentUser() user: any) {
    return this.expensesService.findAll(user.gymId, query);
  }

  @Get('monthly-totals')
  getMonthlyTotals(@Query('year') year: string, @CurrentUser() user: any) {
    return this.expensesService.getMonthlyTotals(user.gymId, +(year ?? new Date().getFullYear()));
  }

  @Get('audit')
  getAuditReport(
    @Query('month') month: string,
    @Query('year') year: string,
    @CurrentUser() user: any,
  ) {
    const now = new Date();
    return this.expensesService.getAuditReport(
      user.gymId,
      +(month ?? now.getMonth() + 1),
      +(year ?? now.getFullYear()),
    );
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateExpenseDto, @CurrentUser() user: any) {
    return this.expensesService.update(id, dto, user.gymId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.expensesService.remove(id, user.gymId);
  }
}
