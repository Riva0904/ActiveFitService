import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePromoCodeDto } from './dto/create-promo-code.dto';

@Injectable()
export class PromoCodesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePromoCodeDto, gymId: string) {
    const existing = await this.prisma.promoCode.findFirst({
      where: { gymId, code: dto.code.toUpperCase() },
    });
    if (existing) throw new BadRequestException('Promo code already exists for this gym');

    return this.prisma.promoCode.create({
      data: {
        ...dto,
        code: dto.code.toUpperCase(),
        gymId,
        validFrom: new Date(dto.validFrom),
        validTo: new Date(dto.validTo),
      },
    });
  }

  async findAll(gymId: string) {
    return this.prisma.promoCode.findMany({
      where: { gymId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, gymId: string) {
    const code = await this.prisma.promoCode.findFirst({ where: { id, gymId } });
    if (!code) throw new NotFoundException('Promo code not found');
    return code;
  }

  async update(id: string, data: Partial<CreatePromoCodeDto>, gymId: string) {
    await this.findOne(id, gymId);
    return this.prisma.promoCode.update({
      where: { id },
      data: {
        ...data,
        validFrom: data.validFrom ? new Date(data.validFrom) : undefined,
        validTo: data.validTo ? new Date(data.validTo) : undefined,
      },
    });
  }

  async remove(id: string, gymId: string) {
    await this.findOne(id, gymId);
    return this.prisma.promoCode.delete({ where: { id } });
  }

  async validate(code: string, gymId: string, amount: number) {
    const promo = await this.prisma.promoCode.findFirst({
      where: { gymId, code: code.toUpperCase(), isActive: true },
    });

    if (!promo) return { valid: false, reason: 'Invalid promo code' };

    const now = new Date();
    if (now < promo.validFrom || now > promo.validTo) {
      return { valid: false, reason: 'Promo code is expired or not yet active' };
    }

    if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
      return { valid: false, reason: 'Promo code usage limit reached' };
    }

    let discountAmount = 0;
    if (promo.discountType === 'PERCENTAGE') {
      discountAmount = (amount * promo.discountValue) / 100;
    } else {
      discountAmount = Math.min(promo.discountValue, amount);
    }

    const finalAmount = Math.max(amount - discountAmount, 1);
    return {
      valid: true,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      discountAmount,
      finalAmount,
      promoCodeId: promo.id,
      description: promo.description,
    };
  }

  async incrementUsage(promoCodeId: string) {
    return this.prisma.promoCode.update({
      where: { id: promoCodeId },
      data: { usedCount: { increment: 1 } },
    });
  }
}
