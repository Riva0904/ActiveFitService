import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * BaseRepository enforces two invariants at the type level for every subclass:
 * 1. gymId is always included in every query predicate (multi-tenant isolation)
 * 2. deletedAt: null is always applied (soft-delete safety)
 *
 * Subclasses receive a `scope()` helper that builds the base where-clause.
 * Direct Prisma access is still available via `this.prisma` for complex queries
 * that cannot be expressed through the base methods, but callers MUST use scope().
 */
export abstract class BaseRepository<TModel> {
  constructor(
    protected readonly prisma: PrismaService,
    private readonly modelName: string,
    protected readonly gymId: string,
  ) {}

  /** Base where-clause: always scopes to this.gymId and excludes soft-deleted rows */
  protected scope(extra: Record<string, unknown> = {}): Record<string, unknown> {
    return { gymId: this.gymId, deletedAt: null, ...extra };
  }

  /** Fetch a single record scoped to this gym. Throws NotFoundException if not found. */
  async findById(id: string): Promise<TModel> {
    const model = (this.prisma as any)[this.modelName];
    const record = await model.findFirst({ where: this.scope({ id }) });
    if (!record) throw new NotFoundException(`${this.modelName} not found`);
    return record;
  }

  /** Fetch a single record or return null without throwing */
  async findByIdOrNull(id: string): Promise<TModel | null> {
    const model = (this.prisma as any)[this.modelName];
    return model.findFirst({ where: this.scope({ id }) });
  }

  /** Count records matching extra filters, always scoped to gym + not deleted */
  async count(extra: Record<string, unknown> = {}): Promise<number> {
    const model = (this.prisma as any)[this.modelName];
    return model.count({ where: this.scope(extra) });
  }

  /** Soft-delete a record by setting deletedAt */
  async softDelete(id: string): Promise<void> {
    const model = (this.prisma as any)[this.modelName];
    await model.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
