import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import * as Joi from 'joi';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { GymScopeGuard } from './common/guards/gym-scope.guard';
import { PrismaModule } from './prisma/prisma.module';
import { EmailModule } from './email/email.module';
import { OtpModule } from './otp/otp.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { GymsModule } from './gyms/gyms.module';
import { MembershipsModule } from './memberships/memberships.module';
import { AttendanceModule } from './attendance/attendance.module';
import { TrainersModule } from './trainers/trainers.module';
import { PtSessionsModule } from './pt-sessions/pt-sessions.module';
import { PaymentsModule } from './payments/payments.module';
import { SupplementsModule } from './supplements/supplements.module';
import { WorkoutPlansModule } from './workout-plans/workout-plans.module';
import { DietPlansModule } from './diet-plans/diet-plans.module';
import { NotificationsModule } from './notifications/notifications.module';
import { InvoicesModule } from './invoices/invoices.module';
import { ProgressLogsModule } from './progress-logs/progress-logs.module';
import { HealthModule } from './health/health.module';
import { ExpensesModule } from './expenses/expenses.module';
import { StaffsModule } from './staffs/staffs.module';
import { LeaveModule } from './leave/leave.module';
import { ChatModule } from './chat/chat.module';
import { RenewalRemindersModule } from './renewal-reminders/renewal-reminders.module';
import { EnquiriesModule } from './enquiries/enquiries.module';
import { ReferralsModule } from './referrals/referrals.module';
import { PromoCodesModule } from './promo-codes/promo-codes.module';
import { SaasPlansModule } from './saas-plans/saas-plans.module';
import { CommonModule } from './common/common.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { GamificationModule } from './gamification/gamification.module';
import { MobileModule } from './mobile/mobile.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'staging', 'production').default('development'),
        PORT: Joi.number().default(3001),
        DATABASE_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().min(32).required(),
        JWT_EXPIRES_IN: Joi.string().default('7d'),
        CORS_ORIGIN: Joi.string().default('http://localhost:3000'),
        RESEND_API_KEY: Joi.string().required(),
        EMAIL_FROM_ADDRESS: Joi.string().default('onboarding@resend.dev'),
      }),
      validationOptions: { allowUnknown: true, abortEarly: false },
    }),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 5 },    // max 5 req/sec per IP (burst protection)
      { name: 'medium', ttl: 60000, limit: 100 }, // max 100 req/min per IP (general API)
    ]),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot({ wildcard: false, delimiter: '.', maxListeners: 20 }),
    PrismaModule,
    EmailModule,
    OtpModule,
    AuthModule,
    UsersModule,
    GymsModule,
    MembershipsModule,
    AttendanceModule,
    TrainersModule,
    PtSessionsModule,
    PaymentsModule,
    SupplementsModule,
    WorkoutPlansModule,
    DietPlansModule,
    NotificationsModule,
    InvoicesModule,
    ProgressLogsModule,
    HealthModule,
    ExpensesModule,
    StaffsModule,
    LeaveModule,
    ChatModule,
    RenewalRemindersModule,
    EnquiriesModule,
    ReferralsModule,
    PromoCodesModule,
    SaasPlansModule,
    CommonModule,
    AnalyticsModule,
    GamificationModule,
    MobileModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: GymScopeGuard },
  ],
})
export class AppModule {}
