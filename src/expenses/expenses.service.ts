import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateExpenseDto, gymId: string) {
    const date = new Date(dto.date);
    return this.prisma.expense.create({
      data: {
        ...dto,
        date,
        month: date.getMonth() + 1,
        year: date.getFullYear(),
        gymId,
      },
    });
  }

  async findAll(gymId: string, query: any) {
    const { month, year, category, page = 1, limit = 50 } = query;
    const where: any = { gymId };
    if (month) where.month = +month;
    if (year) where.year = +year;
    if (category) where.category = category;

    const [data, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        skip: (+page - 1) * +limit,
        take: +limit,
        orderBy: { date: 'desc' },
      }),
      this.prisma.expense.count({ where }),
    ]);

    return { data, total, page: +page, limit: +limit };
  }

  async update(id: string, dto: UpdateExpenseDto, gymId: string) {
    await this.findOne(id, gymId);
    const updateData: any = { ...dto };
    if (dto.date) {
      const date = new Date(dto.date);
      updateData.date = date;
      updateData.month = date.getMonth() + 1;
      updateData.year = date.getFullYear();
    }
    return this.prisma.expense.update({ where: { id }, data: updateData });
  }

  async remove(id: string, gymId: string) {
    await this.findOne(id, gymId);
    return this.prisma.expense.delete({ where: { id } });
  }

  async findOne(id: string, gymId: string) {
    const expense = await this.prisma.expense.findFirst({ where: { id, gymId } });
    if (!expense) throw new NotFoundException('Expense not found');
    return expense;
  }

  async getMonthlyTotals(gymId: string, year: number) {
    const expenses = await this.prisma.expense.groupBy({
      by: ['month', 'category'],
      where: { gymId, year },
      _sum: { amount: true },
    });
    return expenses;
  }

  async getAuditReport(gymId: string, month: number, year: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate   = new Date(year, month, 1);

    // Revenue from completed payments
    const [membershipRev, ptRev, supplementRev] = await Promise.all([
      this.prisma.payment.aggregate({
        where: { gymId, status: 'COMPLETED', type: 'MEMBERSHIP', paidAt: { gte: startDate, lt: endDate } },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: { gymId, status: 'COMPLETED', type: 'PT_SESSION', paidAt: { gte: startDate, lt: endDate } },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: { gymId, status: 'COMPLETED', type: 'SUPPLEMENT', paidAt: { gte: startDate, lt: endDate } },
        _sum: { amount: true },
      }),
    ]);

    // Expenses by category
    const expensesByCategory = await this.prisma.expense.groupBy({
      by: ['category'],
      where: { gymId, month, year },
      _sum: { amount: true },
    });

    const membershipRevenue   = membershipRev._sum.amount ?? 0;
    const ptRevenue           = ptRev._sum.amount ?? 0;
    const supplementRevenue   = supplementRev._sum.amount ?? 0;
    const totalRevenue        = membershipRevenue + ptRevenue + supplementRevenue;
    const totalExpenses       = expensesByCategory.reduce((acc, e) => acc + (e._sum.amount ?? 0), 0);
    const profit              = totalRevenue - totalExpenses;

    // Last 6 months trend
    const trend = await this.getLast6MonthsTrend(gymId, month, year);

    return {
      month,
      year,
      revenue: { membership: membershipRevenue, pt: ptRevenue, supplement: supplementRevenue, total: totalRevenue },
      expenses: { byCategory: expensesByCategory, total: totalExpenses },
      profit,
      profitMargin: totalRevenue > 0 ? Math.round((profit / totalRevenue) * 100) : 0,
      trend,
    };
  }

  private async getLast6MonthsTrend(gymId: string, currentMonth: number, currentYear: number) {
    const months: Array<{ month: number; year: number; label: string }> = [];
    for (let i = 5; i >= 0; i--) {
      let m = currentMonth - i;
      let y = currentYear;
      if (m <= 0) { m += 12; y -= 1; }
      months.push({ month: m, year: y, label: new Date(y, m - 1, 1).toLocaleDateString('en', { month: 'short', year: '2-digit' }) });
    }

    return Promise.all(
      months.map(async ({ month, year, label }) => {
        const start = new Date(year, month - 1, 1);
        const end   = new Date(year, month, 1);

        const [rev, exp] = await Promise.all([
          this.prisma.payment.aggregate({
            where: { gymId, status: 'COMPLETED', paidAt: { gte: start, lt: end } },
            _sum: { amount: true },
          }),
          this.prisma.expense.aggregate({
            where: { gymId, month, year },
            _sum: { amount: true },
          }),
        ]);

        const revenue  = rev._sum.amount ?? 0;
        const expenses = exp._sum.amount ?? 0;
        return { label, revenue, expenses, profit: revenue - expenses };
      }),
    );
  }
}
