import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ProgressLogsService } from './progress-logs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Progress Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('progress-logs')
export class ProgressLogsController {
  constructor(private readonly progressLogsService: ProgressLogsService) {}

  @Get('my')
  getMyLogs(@CurrentUser() user: any) {
    return this.progressLogsService.findByUser(user.id, user.gymId);
  }

  @Post()
  create(@Body() body: any, @CurrentUser() user: any) {
    return this.progressLogsService.create(user.id, user.gymId, body);
  }
}
