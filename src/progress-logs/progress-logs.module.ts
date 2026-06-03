import { Module } from '@nestjs/common';
import { ProgressLogsService } from './progress-logs.service';
import { ProgressLogsController } from './progress-logs.controller';

@Module({ controllers: [ProgressLogsController], providers: [ProgressLogsService] })
export class ProgressLogsModule {}
