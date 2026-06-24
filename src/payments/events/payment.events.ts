export const PAYMENT_COMPLETED = 'payment.completed';

export class PaymentCompletedEvent {
  constructor(
    public readonly paymentId: string,
    public readonly gymId: string,
    public readonly memberId: string,
    public readonly type: string,
    public readonly amount: number,
    public readonly promoCodeId?: string,
    public readonly dietPlanId?: string,
    public readonly workoutPlanId?: string,
    public readonly membershipPlanId?: string,
  ) {}
}
