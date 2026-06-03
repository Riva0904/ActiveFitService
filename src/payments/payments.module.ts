import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController, PaymentsWebhookController } from './payments.controller';
import { PaymentRepository } from './payment.repository';
import { PaymentEventsHandler } from './payment-events.handler';
import { PricingService } from './domain/pricing.service';
import { ReferralsModule } from '../referrals/referrals.module';
import { PromoCodesModule } from '../promo-codes/promo-codes.module';

@Module({
  imports: [ReferralsModule, PromoCodesModule],
  controllers: [PaymentsWebhookController, PaymentsController],
  providers: [PaymentsService, PaymentRepository, PaymentEventsHandler, PricingService],
  exports: [PaymentsService, PaymentRepository, PricingService],
})
export class PaymentsModule {}
