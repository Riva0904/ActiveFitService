import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { EnquiriesService } from './enquiries.service';
import { CreateEnquiryDto } from './dto/create-enquiry.dto';
import { UpdateEnquiryDto, ConvertEnquiryDto } from './dto/update-enquiry.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { EnquiryStatus } from '@prisma/client';

@Controller('enquiries')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EnquiriesController {
  constructor(private readonly service: EnquiriesService) {}

  @Post()
  @Roles('GYM_ADMIN', 'STAFF')
  create(@Body() dto: CreateEnquiryDto, @CurrentUser() user: any) {
    return this.service.create(dto, user.gymId);
  }

  @Get()
  @Roles('GYM_ADMIN', 'STAFF')
  findAll(
    @CurrentUser() user: any,
    @Query('status') status?: EnquiryStatus,
    @Query('source') source?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll(user.gymId, { status, source, search, page: page ? +page : undefined, limit: limit ? +limit : undefined });
  }

  @Get('kanban-stats')
  @Roles('GYM_ADMIN', 'STAFF')
  kanbanStats(@CurrentUser() user: any) {
    return this.service.getKanbanStats(user.gymId);
  }

  @Get(':id')
  @Roles('GYM_ADMIN', 'STAFF')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.findOne(id, user.gymId);
  }

  @Patch(':id')
  @Roles('GYM_ADMIN', 'STAFF')
  update(@Param('id') id: string, @Body() dto: UpdateEnquiryDto, @CurrentUser() user: any) {
    return this.service.update(id, dto, user.gymId);
  }

  @Patch(':id/convert')
  @Roles('GYM_ADMIN')
  convert(@Param('id') id: string, @Body() dto: ConvertEnquiryDto, @CurrentUser() user: any) {
    return this.service.convert(id, user.gymId, dto.userId);
  }

  @Delete(':id')
  @Roles('GYM_ADMIN')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.remove(id, user.gymId);
  }
}
