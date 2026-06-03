import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { PromoCodesService } from './promo-codes.service';
import { CreatePromoCodeDto } from './dto/create-promo-code.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IsString, IsNumber, IsOptional } from 'class-validator';

class ValidatePromoDto {
  @IsString()
  code: string;

  @IsOptional()
  @IsNumber()
  amount?: number;
}

@Controller('promo-codes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PromoCodesController {
  constructor(private readonly service: PromoCodesService) {}

  @Post()
  @Roles('GYM_ADMIN')
  create(@Body() dto: CreatePromoCodeDto, @CurrentUser() user: any) {
    return this.service.create(dto, user.gymId);
  }

  @Get()
  @Roles('GYM_ADMIN')
  findAll(@CurrentUser() user: any) {
    return this.service.findAll(user.gymId);
  }

  @Get(':id')
  @Roles('GYM_ADMIN')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.findOne(id, user.gymId);
  }

  @Patch(':id')
  @Roles('GYM_ADMIN')
  update(@Param('id') id: string, @Body() dto: Partial<CreatePromoCodeDto>, @CurrentUser() user: any) {
    return this.service.update(id, dto, user.gymId);
  }

  @Delete(':id')
  @Roles('GYM_ADMIN')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.remove(id, user.gymId);
  }

  @Post('validate')
  @Roles('GYM_ADMIN', 'MEMBER')
  validate(@Body() dto: ValidatePromoDto, @CurrentUser() user: any) {
    return this.service.validate(dto.code, user.gymId, dto.amount ?? 0);
  }
}
