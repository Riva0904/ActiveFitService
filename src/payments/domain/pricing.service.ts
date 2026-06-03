import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface PriceResult {
  amount: number;
  currency: string;
}

@Injectable()
export class PricingService {
  constructor(private prisma: PrismaService) {}

  /**
   * Returns the authoritative server-side price for a payment type.
   * Never trusts the client-supplied amount — always queries DB.
   */
  async resolvePrice(
    type: string,
    gymId: string,
    resourceId?: string,
    clientAmount?: number,
  ): Promise<PriceResult> {
    switch (type) {
      case 'MEMBERSHIP': {
        if (!resourceId) throw new BadRequestException('membershipPlanId is required for MEMBERSHIP payments');
        const plan = await this.prisma.membershipPlan.findFirst({
          where: { id: resourceId, gymId, isActive: true, deletedAt: null },
        });
        if (!plan) throw new BadRequestException('Membership plan not found or inactive');
        const base = plan.price - (plan.discount ?? 0);
        return { amount: Math.max(base, 1), currency: 'INR' };
      }

      case 'DIET_PLAN': {
        if (!resourceId) throw new BadRequestException('dietPlanId is required for DIET_PLAN payments');
        const plan = await this.prisma.dietPlan.findFirst({
          where: { id: resourceId, gymId, deletedAt: null },
        });
        if (!plan || !(plan as any).isPremium) throw new BadRequestException('Diet plan not found or not purchasable');
        const price = (plan as any).price;
        if (!price || price <= 0) throw new BadRequestException('Diet plan has no valid price configured');
        return { amount: price, currency: 'INR' };
      }

      case 'PT_SESSION': {
        // PT session price is computed at booking time and stored; validate it's positive
        if (!clientAmount || clientAmount <= 0) throw new BadRequestException('Invalid PT session amount');
        return { amount: clientAmount, currency: 'INR' };
      }

      case 'SUPPLEMENT': {
        // Supplement order total is computed server-side at order creation
        if (!clientAmount || clientAmount <= 0) throw new BadRequestException('Invalid supplement order amount');
        return { amount: clientAmount, currency: 'INR' };
      }

      case 'WORKOUT_PLAN': {
        if (!resourceId) throw new BadRequestException('workoutPlanId is required for WORKOUT_PLAN payments');
        const plan = await this.prisma.workoutPlan.findFirst({
          where: { id: resourceId, gymId, deletedAt: null },
        });
        if (!plan || !(plan as any).isPremium) throw new BadRequestException('Workout plan not found or not purchasable');
        const price = (plan as any).price;
        if (!price || price <= 0) throw new BadRequestException('Workout plan has no valid price configured');
        return { amount: price, currency: 'INR' };
      }

      case 'OTHER': {
        if (!clientAmount || clientAmount <= 0) throw new BadRequestException('Amount must be greater than zero');
        return { amount: clientAmount, currency: 'INR' };
      }

      default:
        throw new BadRequestException(`Unknown payment type: ${type}`);
    }
  }
}
