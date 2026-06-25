import { Module } from '@nestjs/common';
import { SalaryPayoutsService } from './salary-payouts.service';
import { SalaryPayoutsController } from './salary-payouts.controller';

@Module({
  controllers: [SalaryPayoutsController],
  providers: [SalaryPayoutsService],
})
export class SalaryPayoutsModule {}
