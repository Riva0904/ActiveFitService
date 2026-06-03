import { Module } from '@nestjs/common';
import { DietPlansService } from './diet-plans.service';
import { DietPlansController } from './diet-plans.controller';
import { PaymentsModule } from '../payments/payments.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({ imports: [PaymentsModule, NotificationsModule], controllers: [DietPlansController], providers: [DietPlansService] })
export class DietPlansModule {}
