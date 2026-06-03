import { Module } from '@nestjs/common';
import { RenewalRemindersService } from './renewal-reminders.service';
import { RenewalRemindersController } from './renewal-reminders.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [RenewalRemindersController],
  providers: [RenewalRemindersService],
  exports: [RenewalRemindersService],
})
export class RenewalRemindersModule {}
