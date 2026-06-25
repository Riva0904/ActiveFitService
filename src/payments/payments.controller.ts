import { Controller, Get, Post, Body, Param, Query, UseGuards, Headers, Req, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RecordCashPaymentDto } from './dto/record-cash-payment.dto';

// Webhook handler — NO auth guard (called by Razorpay server-to-server)
@ApiTags('Payments')
@Controller('payments')
export class PaymentsWebhookController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  handleWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-razorpay-signature') signature: string,
  ) {
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body));
    return this.paymentsService.handleRazorpayWebhook(rawBody, signature);
  }
}

@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN)
  findAll(@Query() query: any, @CurrentUser() user: any) {
    const gymId = user.role === Role.GYM_ADMIN ? user.gymId : query.gymId;
    return this.paymentsService.findAll(query, gymId);
  }

  @Get('my')
  getMyPayments(@Query() query: any, @CurrentUser() user: any) {
    return this.paymentsService.findAll(query, user.gymId, user.id);
  }

  @Get('stats')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN)
  getStats(@CurrentUser() user: any) {
    return this.paymentsService.getRevenueStats(user.gymId);
  }

  @Get('stats/monthly')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN, Role.SUPER_ADMIN)
  getMonthlyStats(@CurrentUser() user: any) {
    return this.paymentsService.getMonthlyRevenueBreakdown(user.gymId);
  }

  // Public endpoint — only MEMBERSHIP is safe here (server re-prices via membershipPlanId).
  // DIET_PLAN / PT_SESSION / WORKOUT_PLAN go through their own modules' buy/book endpoints,
  // which compute price server-side and call paymentsService.createRazorpayOrder() directly —
  // never expose those types here, or a caller can pass an arbitrary `amount` for them.
  @Post('create-order')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  createOrder(
    @Body() body: { amount: number; type: string; promoCode?: string; referralCreditToApply?: number; membershipPlanId?: string; useUpi?: boolean },
    @CurrentUser() user: any,
  ) {
    if (body.type !== 'MEMBERSHIP') {
      throw new BadRequestException('Use the dedicated purchase endpoint for this payment type');
    }
    return this.paymentsService.createRazorpayOrder(
      body.amount, user.id, user.gymId, body.type, body.promoCode, body.referralCreditToApply, body.membershipPlanId, !!body.useUpi,
    );
  }

  @Post('verify')
  verifyPayment(
    @Body() body: { paymentId: string; razorpayPaymentId: string; signature: string },
    @CurrentUser() user: any,
  ) {
    return this.paymentsService.verifyPayment(body.paymentId, body.razorpayPaymentId, body.signature, user.id);
  }

  @Post('cash')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN)
  recordCash(@Body() body: RecordCashPaymentDto, @CurrentUser() user: any) {
    return this.paymentsService.recordCashPayment({ ...body, gymId: user.gymId });
  }

  // ── Manual UPI (no gateway, gym admin's own VPA) ──────────────────────────

  @Post(':id/mark-paid')
  markPaid(@Param('id') id: string, @CurrentUser() user: any) {
    return this.paymentsService.markMemberPaid(id, user.id);
  }

  @Get('manual-upi/pending')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN)
  getPendingManualUpi(@CurrentUser() user: any) {
    return this.paymentsService.getPendingManualUpiPayments(user.gymId);
  }

  @Post(':id/confirm-upi')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN)
  confirmManualUpi(@Param('id') id: string, @CurrentUser() user: any) {
    return this.paymentsService.confirmManualPayment(id, user.gymId);
  }
}
