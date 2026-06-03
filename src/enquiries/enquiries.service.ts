import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEnquiryDto } from './dto/create-enquiry.dto';
import { UpdateEnquiryDto } from './dto/update-enquiry.dto';
import { EnquiryStatus } from '@prisma/client';

@Injectable()
export class EnquiriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateEnquiryDto, gymId: string) {
    return this.prisma.enquiry.create({
      data: { ...dto, gymId, followUpDate: dto.followUpDate ? new Date(dto.followUpDate) : undefined },
    });
  }

  async findAll(
    gymId: string,
    query: { status?: EnquiryStatus; source?: string; search?: string; page?: number; limit?: number },
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = { gymId };
    if (query.status) where.status = query.status;
    if (query.source) where.source = query.source;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.enquiry.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.enquiry.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getKanbanStats(gymId: string) {
    const statuses = Object.values(EnquiryStatus);
    const counts = await Promise.all(
      statuses.map(async (status) => ({
        status,
        count: await this.prisma.enquiry.count({ where: { gymId, status } }),
      })),
    );
    return counts;
  }

  async findOne(id: string, gymId: string) {
    const enquiry = await this.prisma.enquiry.findFirst({ where: { id, gymId } });
    if (!enquiry) throw new NotFoundException('Enquiry not found');
    return enquiry;
  }

  async update(id: string, dto: UpdateEnquiryDto, gymId: string) {
    await this.findOne(id, gymId);
    return this.prisma.enquiry.update({
      where: { id },
      data: { ...dto, followUpDate: dto.followUpDate ? new Date(dto.followUpDate) : undefined },
    });
  }

  async convert(id: string, gymId: string, userId?: string) {
    await this.findOne(id, gymId);
    return this.prisma.enquiry.update({
      where: { id },
      data: { status: EnquiryStatus.CONVERTED, convertedMemberId: userId ?? null },
    });
  }

  async remove(id: string, gymId: string) {
    await this.findOne(id, gymId);
    return this.prisma.enquiry.delete({ where: { id } });
  }
}
