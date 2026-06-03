import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SupplementsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: any, gymId?: string) {
    const { page = 1, limit = 12, search, category } = query;
    const skip = (page - 1) * limit;
    const where: any = { isActive: true };
    if (gymId) where.gymId = gymId;
    if (search) where.name = { contains: search, mode: 'insensitive' };
    if (category) where.category = category;

    const [supplements, total] = await Promise.all([
      this.prisma.supplement.findMany({ where, skip, take: +limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.supplement.count({ where }),
    ]);

    return { data: supplements, total, page: +page, limit: +limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const s = await this.prisma.supplement.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Supplement not found');
    return s;
  }

  async create(data: any) {
    return this.prisma.supplement.create({ data });
  }

  async update(id: string, data: any) {
    await this.findOne(id);
    return this.prisma.supplement.update({ where: { id }, data });
  }

  async updateStock(id: string, quantity: number) {
    const s = await this.findOne(id);
    const newStock = s.stock + quantity;
    if (newStock < 0) throw new BadRequestException('Stock cannot go below zero');
    return this.prisma.supplement.update({ where: { id }, data: { stock: newStock } });
  }

  async createOrder(userId: string, gymId: string, items: Array<{ supplementId: string; quantity: number }>) {
    if (!items || items.length === 0) throw new BadRequestException('Order must contain at least one item');

    return this.prisma.$transaction(async (tx) => {
      let totalAmount = 0;
      const orderItems: any[] = [];

      for (const item of items) {
        // Verify supplement belongs to this gym
        const supplement = await tx.supplement.findFirst({
          where: { id: item.supplementId, gymId, isActive: true },
        });
        if (!supplement) throw new NotFoundException(`Supplement not found: ${item.supplementId}`);
        if (supplement.stock < item.quantity) throw new BadRequestException(`Insufficient stock for ${supplement.name}`);

        const price = supplement.discountPrice ?? supplement.price;
        totalAmount += price * item.quantity;
        orderItems.push({ supplementId: item.supplementId, quantity: item.quantity, unitPrice: price, totalPrice: price * item.quantity });
      }

      const order = await tx.supplementOrder.create({
        data: {
          userId,
          gymId,
          orderNumber: `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
          totalAmount,
          items: { create: orderItems },
        },
        include: { items: { include: { supplement: true } } },
      });

      // Atomically decrement stock — fails if stock dropped below required quantity concurrently
      for (const item of items) {
        const updated = await tx.supplement.updateMany({
          where: { id: item.supplementId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (updated.count === 0) throw new BadRequestException('Insufficient stock (concurrent order conflict)');
      }

      return order;
    });
  }

  async getOrders(query: any, gymId?: string, userId?: string) {
    const { page = 1, limit = 10 } = query;
    const where: any = {};
    if (gymId) where.gymId = gymId;
    if (userId) where.userId = userId;

    const [orders, total] = await Promise.all([
      this.prisma.supplementOrder.findMany({
        where,
        skip: (page - 1) * limit,
        take: +limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: { include: { supplement: { select: { name: true, images: true } } } },
          user: { select: { firstName: true, lastName: true } },
        },
      }),
      this.prisma.supplementOrder.count({ where }),
    ]);

    return { data: orders, total, page: +page, limit: +limit, totalPages: Math.ceil(total / limit) };
  }

  async remove(id: string, gymId: string) {
    const s = await this.prisma.supplement.findFirst({ where: { id, gymId } });
    if (!s) throw new NotFoundException('Supplement not found');
    await this.prisma.supplement.update({ where: { id }, data: { isActive: false } });
    return { message: 'Supplement removed successfully' };
  }

  async updateOrderStatus(orderId: string, status: any) {
    const VALID_TRANSITIONS: Record<string, string[]> = {
      PENDING: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['DELIVERED', 'CANCELLED'],
      DELIVERED: [],
      CANCELLED: [],
    };
    const order = await this.prisma.supplementOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    const allowed = VALID_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(`Cannot transition order from ${order.status} to ${status}`);
    }
    return this.prisma.supplementOrder.update({ where: { id: orderId }, data: { status } });
  }
}
