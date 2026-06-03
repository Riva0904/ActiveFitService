import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPrisma = any;

@Injectable()
export class InvoicesService {
  constructor(private prisma: PrismaService) {}

  private get db(): AnyPrisma { return this.prisma; }

  async findAll(query: any, gymId?: string, userId?: string) {
    const { page = 1, limit = 10, status } = query;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (gymId) where.gymId = gymId;
    if (userId) where.userId = userId;
    if (status) where.status = status;

    const [invoices, total] = await Promise.all([
      this.db.invoice.findMany({
        where,
        skip,
        take: +limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
      }),
      this.db.invoice.count({ where }),
    ]);

    return { data: invoices, total, page: +page, limit: +limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string, requesterId: string, requesterRole: string) {
    const invoice = await this.db.invoice.findUnique({
      where: { id },
      include: {
        user: { select: { firstName: true, lastName: true, email: true, phone: true } },
        gym: { select: { name: true, address: true, phone: true, email: true, logo: true } },
        membership: true,
        payment: true,
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (requesterRole !== 'ADMIN' && requesterRole !== 'SUPER_ADMIN' && invoice.userId !== requesterId) {
      throw new ForbiddenException('Access denied');
    }
    return invoice;
  }

  async create(data: any) {
    const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    return this.db.invoice.create({ data: { ...data, invoiceNumber } });
  }

  async updateStatus(id: string, status: any) {
    return this.db.invoice.update({ where: { id }, data: { status } });
  }

  async getMyInvoices(userId: string) {
    return this.db.invoice.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { membership: true },
    });
  }
}
