import { Module } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceExportService } from './attendance-export.service';
import { AttendanceController } from './attendance.controller';

@Module({
  controllers: [AttendanceController],
  providers: [AttendanceService, AttendanceExportService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
