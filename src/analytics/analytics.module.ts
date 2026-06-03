import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { RetentionService } from './retention.service';
import { RevenueService } from './revenue.service';

@Module({
  controllers: [AnalyticsController],
  providers: [RetentionService, RevenueService],
  exports: [RetentionService, RevenueService],
})
export class AnalyticsModule {}
