import { Module } from '@nestjs/common';
import { PtSessionsService } from './pt-sessions.service';
import { PtSessionsController } from './pt-sessions.controller';
import { PaymentsModule } from '../payments/payments.module';

@Module({ imports: [PaymentsModule], controllers: [PtSessionsController], providers: [PtSessionsService] })
export class PtSessionsModule {}
