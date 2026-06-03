import { Module } from '@nestjs/common';
import { GamificationController } from './gamification.controller';
import { PointsService } from './points.service';
import { BadgeService } from './badge.service';

@Module({
  controllers: [GamificationController],
  providers: [PointsService, BadgeService],
  exports: [PointsService, BadgeService],
})
export class GamificationModule {}
